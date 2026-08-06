import { prisma } from "@/lib/prisma";
import { configuredMarketDataProvider } from "@/lib/market-data/provider-registry";
import { resolveCanonicalSecurity } from "@/lib/market-data/security-resolver";
import { refreshQuoteForSecurity } from "@/lib/market-data/service";

export class PaperQuoteError extends Error {}

export type PaperQuote = {
  ticker: string;
  name: string;
  price: string | null;
  currency: string | null;
  status: string;
  retrievedAt: Date | null;
};

function normalizeTicker(ticker: string) {
  const value = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(value))
    throw new PaperQuoteError("Enter a valid ticker symbol.");
  return value;
}

/**
 * Paper trading deliberately uses the established resolver, provider budget,
 * and persisted quote cache. It never calls a market-data vendor directly.
 */
export async function getPaperTradeQuote(
  tickerInput: string,
  options: { refresh?: boolean } = {},
): Promise<PaperQuote> {
  const ticker = normalizeTicker(tickerInput);
  const provider = configuredMarketDataProvider();
  if (!provider)
    throw new PaperQuoteError("Live market data is unavailable right now. Add a simulated price after market data is configured.");

  let security = await prisma.security.findUnique({
    where: { canonicalSymbol: ticker },
  });
  let created = false;
  if (!security) {
    security = await prisma.security.create({
      data: { canonicalSymbol: ticker, name: ticker },
    });
    created = true;
  }
  const resolution = await resolveCanonicalSecurity(security.id);
  if (resolution.status !== "RESOLVED") {
    if (created)
      await prisma.security
        .delete({ where: { id: security.id } })
        .catch(() => undefined);
    throw new PaperQuoteError(
      resolution.message ?? "We could not verify that ticker symbol.",
    );
  }
  if (resolution.candidate?.name && resolution.candidate.name !== security.name) {
    security = await prisma.security.update({
      where: { id: security.id },
      data: { name: resolution.candidate.name },
    });
  }
  await refreshQuoteForSecurity(security.id, options.refresh ?? false);
  const quote = await prisma.marketQuote.findUnique({
    where: { securityId_provider: { securityId: security.id, provider: provider.id } },
  });
  return {
    ticker,
    name: security.name,
    price: quote?.price?.toString() ?? null,
    currency: quote?.currency ?? null,
    status: quote?.dataStatus ?? "UNAVAILABLE",
    retrievedAt: quote?.retrievedAt ?? null,
  };
}

export async function getCachedPaperQuote(tickerInput: string) {
  const ticker = normalizeTicker(tickerInput);
  const provider = configuredMarketDataProvider();
  if (!provider) return null;
  const security = await prisma.security.findUnique({
    where: { canonicalSymbol: ticker },
    include: { marketQuotes: { where: { provider: provider.id }, take: 1 } },
  });
  const quote = security?.marketQuotes[0];
  return quote?.price
    ? { price: quote.price.toString(), status: quote.dataStatus, retrievedAt: quote.retrievedAt }
    : null;
}
