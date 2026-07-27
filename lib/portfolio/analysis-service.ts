import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ANALYTICS_ENGINE_VERSION,
  ANALYTICS_FORMULA_VERSION,
  analyzePortfolio,
} from "@/lib/portfolio/analytics-engine";

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** Rebuilds an immutable, reproducible analysis from a user-owned portfolio. */
export async function recalculatePortfolioAnalysis(input: {
  userId: string;
  portfolioId: string;
  benchmark?: { key: string; symbol: string };
}) {
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: input.portfolioId, userId: input.userId },
    include: {
      accounts: {
        where: { userId: input.userId, isIncludedInAnalysis: true },
        include: {
          holdings: {
            include: {
              security: {
                include: {
                  marketQuotes: { orderBy: { retrievedAt: "desc" }, take: 1 },
                  marketResolutions: {
                    orderBy: { updatedAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
          cashBalances: true,
          transactions: true,
        },
      },
    },
  });
  if (!portfolio) return null;
  const asOf = new Date();
  const snapshot = await prisma.portfolioSnapshot.create({
    data: {
      portfolioId: portfolio.id,
      snapshotDate: asOf,
      totalValue: portfolio.accounts
        .flatMap((account) => account.holdings)
        .reduce(
          (sum, holding) => sum.plus(holding.marketValue),
          new Prisma.Decimal(0),
        ),
      cashValue: portfolio.accounts
        .flatMap((account) => account.cashBalances)
        .reduce((sum, cash) => sum.plus(cash.amount), new Prisma.Decimal(0)),
      investedValue: portfolio.accounts
        .flatMap((account) => account.holdings)
        .reduce(
          (sum, holding) => sum.plus(holding.marketValue),
          new Prisma.Decimal(0),
        ),
      sourceCoverage: { source: "deterministic_analytics" },
      holdings: {
        create: portfolio.accounts.flatMap((account) =>
          account.holdings.map((holding) => ({
            accountId: account.id,
            securityId: holding.securityId,
            quantity: holding.quantity,
            marketValue: holding.marketValue,
            costBasis: holding.costBasis,
            currency: holding.currency,
          })),
        ),
      },
    },
  });
  const analysis = analyzePortfolio({
    id: snapshot.id,
    portfolioId: portfolio.id,
    asOf,
    currency: portfolio.currency,
    holdings: portfolio.accounts.flatMap((account) =>
      account.holdings.map((holding) => ({
        securityId: holding.securityId,
        symbol: holding.security.canonicalSymbol,
        name: holding.security.name,
        securityType: holding.security.securityType,
        sector: holding.security.sector,
        industry: holding.security.industry,
        country: holding.security.country,
        currency: holding.currency,
        accountId: account.id,
        accountName: account.name,
        marketValue: holding.marketValue.toString(),
        costBasis: holding.costBasis?.toString() ?? null,
        currentPrice: holding.currentPrice?.toString() ?? null,
        previousClose:
          holding.security.marketQuotes[0]?.previousClose?.toString() ?? null,
        resolved: holding.security.marketResolutions[0]?.status === "RESOLVED",
        stale: holding.security.marketQuotes[0]?.dataStatus === "STALE",
      })),
    ),
    cash: portfolio.accounts.flatMap((account) =>
      account.cashBalances.map((cash) => ({
        accountId: account.id,
        currency: cash.currency,
        amount: cash.amount.toString(),
      })),
    ),
    transactions: portfolio.accounts.flatMap((account) =>
      account.transactions.map((transaction) => ({
        type: transaction.type,
        amount: transaction.amount.toString(),
        fees: transaction.fees?.toString() ?? null,
      })),
    ),
    benchmark: input.benchmark
      ? { ...input.benchmark, returns: [] }
      : undefined,
  });
  const inputHash = createHash("sha256")
    .update(JSON.stringify(analysis))
    .digest("hex");
  return prisma.portfolioAnalysis.create({
    data: {
      portfolioId: portfolio.id,
      portfolioSnapshotId: snapshot.id,
      engineVersion: ANALYTICS_ENGINE_VERSION,
      formulaVersion: ANALYTICS_FORMULA_VERSION,
      benchmarkKey: input.benchmark?.key ?? "NONE",
      benchmarkSymbol: input.benchmark?.symbol,
      dataTimestamp: asOf,
      assumptions: json(analysis.dataQuality.assumptions),
      result: json(analysis),
      inputHash,
    },
  });
}
