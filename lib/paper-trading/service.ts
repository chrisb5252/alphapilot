import { Prisma, type PaperTransactionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEntitlementsForUser } from "@/lib/entitlements";
import { getCachedPaperQuote, getPaperTradeQuote } from "@/lib/market-data/paper-quote";

const ZERO = new Prisma.Decimal(0);
const DEFAULT_STARTING_CASH = new Prisma.Decimal(100_000);

export class PaperTradingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function normalizePaperTicker(value: string) {
  const ticker = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(ticker))
    throw new PaperTradingError("Enter a valid ticker symbol.");
  return ticker;
}

function positiveDecimal(value: string | number, label: string) {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new PaperTradingError(`${label} must be a number.`);
  }
  if (!amount.isFinite() || amount.lte(ZERO))
    throw new PaperTradingError(`${label} must be greater than zero.`);
  return amount;
}

export function calculateCash(
  startingCash: Prisma.Decimal,
  transactions: Array<{
    type: PaperTransactionType;
    shares: Prisma.Decimal;
    priceAtAction: Prisma.Decimal;
  }>,
) {
  return transactions.reduce((cash, transaction) => {
    const amount = transaction.shares.mul(transaction.priceAtAction);
    return transaction.type === "BUY" ? cash.minus(amount) : cash.plus(amount);
  }, startingCash);
}

export function calculateAverageCost(
  existingShares: Prisma.Decimal,
  existingAverageCost: Prisma.Decimal,
  purchasedShares: Prisma.Decimal,
  purchasePrice: Prisma.Decimal,
) {
  return existingShares
    .mul(existingAverageCost)
    .plus(purchasedShares.mul(purchasePrice))
    .div(existingShares.plus(purchasedShares));
}

export function assertTradePermitted(input: {
  cash: Prisma.Decimal;
  heldShares: Prisma.Decimal | null;
  type: PaperTransactionType;
  shares: Prisma.Decimal;
  price: Prisma.Decimal;
}) {
  if (input.type === "BUY" && input.shares.mul(input.price).gt(input.cash))
    throw new PaperTradingError("You do not have enough simulated cash for this purchase.");
  if (
    input.type === "SELL" &&
    (!input.heldShares || input.shares.gt(input.heldShares))
  )
    throw new PaperTradingError("You cannot sell more simulated shares than you hold.");
}

export function calculatePaperPortfolioValue(
  cash: Prisma.Decimal,
  positionValues: Array<Prisma.Decimal | null>,
) {
  if (positionValues.some((value) => value === null)) return null;
  const knownValues = positionValues.filter(
    (value): value is Prisma.Decimal => value !== null,
  );
  return knownValues.reduce((total, value) => total.plus(value), cash);
}

export async function createPaperPortfolio(input: {
  userId: string;
  name?: string;
  startingCashUSD?: string | number;
}) {
  const entitlement = getEntitlementsForUser(input.userId);
  const existing = await prisma.paperPortfolio.count({
    where: { userId: input.userId },
  });
  if (existing >= entitlement.paperPortfolioLimit)
    throw new PaperTradingError(
      `Your ${entitlement.plan === "FREE" ? "free" : "current"} plan supports up to ${entitlement.paperPortfolioLimit} paper portfolios.`,
      403,
    );
  const startingCash = input.startingCashUSD
    ? positiveDecimal(input.startingCashUSD, "Starting cash")
    : DEFAULT_STARTING_CASH;
  if (startingCash.gt(new Prisma.Decimal(100_000_000)))
    throw new PaperTradingError("Starting cash cannot exceed $100,000,000.");
  return prisma.paperPortfolio.create({
    data: {
      userId: input.userId,
      name: input.name?.trim().slice(0, 80) || "My paper portfolio",
      startingCashUSD: startingCash,
    },
  });
}

export async function getOwnedPaperPortfolio(userId: string, portfolioId: string) {
  const portfolio = await prisma.paperPortfolio.findFirst({
    where: { id: portfolioId, userId },
    include: {
      positions: { orderBy: { ticker: "asc" } },
      transactions: { orderBy: { timestamp: "asc" } },
      snapshots: { orderBy: { timestamp: "asc" } },
    },
  });
  if (!portfolio) throw new PaperTradingError("Paper portfolio not found.", 404);
  return portfolio;
}

export async function listPaperPortfolios(userId: string) {
  return prisma.paperPortfolio.findMany({
    where: { userId },
    include: { positions: true, transactions: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function executePaperTrade(input: {
  userId: string;
  paperPortfolioId: string;
  ticker: string;
  type: PaperTransactionType;
  shares: string | number;
  priceAtAction: string | number;
}) {
  const ticker = normalizePaperTicker(input.ticker);
  const shares = positiveDecimal(input.shares, "Shares");
  const price = positiveDecimal(input.priceAtAction, "Simulated execution price");
  // Always validate the security through the existing provider-neutral resolver.
  await getPaperTradeQuote(ticker);

  return prisma.$transaction(
    async (tx) => {
      const portfolio = await tx.paperPortfolio.findFirst({
        where: { id: input.paperPortfolioId, userId: input.userId },
        include: { transactions: true },
      });
      if (!portfolio) throw new PaperTradingError("Paper portfolio not found.", 404);
      const position = await tx.paperPosition.findUnique({
        where: { paperPortfolioId_ticker: { paperPortfolioId: portfolio.id, ticker } },
      });
      const cash = calculateCash(portfolio.startingCashUSD, portfolio.transactions);
      const amount = shares.mul(price);
      assertTradePermitted({
        cash,
        heldShares: position?.shares ?? null,
        type: input.type,
        shares,
        price,
      });

      await tx.paperTransaction.create({
        data: { paperPortfolioId: portfolio.id, ticker, type: input.type, shares, priceAtAction: price },
      });
      if (input.type === "BUY") {
        if (position) {
          await tx.paperPosition.update({
            where: { id: position.id },
            data: {
              shares: position.shares.plus(shares),
              avgCostBasis: calculateAverageCost(position.shares, position.avgCostBasis, shares, price),
            },
          });
        } else {
          await tx.paperPosition.create({
            data: { paperPortfolioId: portfolio.id, ticker, shares, avgCostBasis: price, openedAt: new Date() },
          });
        }
      } else if (position) {
        const remaining = position.shares.minus(shares);
        if (remaining.eq(ZERO)) await tx.paperPosition.delete({ where: { id: position.id } });
        else await tx.paperPosition.update({ where: { id: position.id }, data: { shares: remaining } });
      }
      await tx.paperPortfolio.update({
        where: { id: portfolio.id },
        data: { updatedAt: new Date() },
      });
      return { cashAfter: input.type === "BUY" ? cash.minus(amount) : cash.plus(amount) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

type ViewPosition = { ticker: string; shares: Prisma.Decimal; avgCostBasis: Prisma.Decimal; openedAt: Date };

async function valuePositions(positions: ViewPosition[]) {
  const values = await Promise.all(
    positions.map(async (position) => {
      const quote = await getCachedPaperQuote(position.ticker);
      const currentPrice = quote ? new Prisma.Decimal(quote.price) : null;
      const marketValue = currentPrice ? position.shares.mul(currentPrice) : null;
      const costBasis = position.shares.mul(position.avgCostBasis);
      return {
        ticker: position.ticker,
        shares: position.shares,
        avgCostBasis: position.avgCostBasis,
        openedAt: position.openedAt,
        currentPrice,
        marketValue,
        costBasis,
        gainLoss: marketValue ? marketValue.minus(costBasis) : null,
        quote,
      };
    }),
  );
  return values;
}

export async function paperPortfolioView(userId: string, paperPortfolioId: string) {
  const portfolio = await getOwnedPaperPortfolio(userId, paperPortfolioId);
  const cash = calculateCash(portfolio.startingCashUSD, portfolio.transactions);
  const positions = await valuePositions(portfolio.positions);
  const allPricesAvailable = positions.every((position) => position.marketValue !== null);
  const investedValue = allPricesAvailable
    ? positions.reduce((sum, position) => sum.plus(position.marketValue!), ZERO)
    : null;
  const totalValue = calculatePaperPortfolioValue(cash, positions.map((position) => position.marketValue));
  return { portfolio, cash, positions, totalValue, investedValue, allPricesAvailable };
}

export async function paperPortfolioSummary(userId: string) {
  const portfolios = await listPaperPortfolios(userId);
  return Promise.all(
    portfolios.map(async (portfolio) => {
      const cash = calculateCash(portfolio.startingCashUSD, portfolio.transactions);
      const valued = await valuePositions(portfolio.positions);
      const priced = valued.every((position) => position.marketValue !== null);
      const totalValue = calculatePaperPortfolioValue(cash, valued.map((position) => position.marketValue));
      return { portfolio, cash, totalValue, priced };
    }),
  );
}

/** Daily only; no historical price backfill is performed for paper portfolios. */
export async function createDailyPaperSnapshots() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const portfolios = await prisma.paperPortfolio.findMany({ select: { id: true, userId: true } });
  let created = 0;
  for (const portfolio of portfolios) {
    const view = await paperPortfolioView(portfolio.userId, portfolio.id);
    if (!view.totalValue) continue;
    await prisma.paperSnapshot.upsert({
      where: { paperPortfolioId_timestamp: { paperPortfolioId: portfolio.id, timestamp: today } },
      create: { paperPortfolioId: portfolio.id, totalValueUSD: view.totalValue, cashUSD: view.cash, timestamp: today },
      update: { totalValueUSD: view.totalValue, cashUSD: view.cash },
    });
    created += 1;
  }
  return { created, skipped: portfolios.length - created };
}
