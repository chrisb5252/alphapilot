import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { MarketDataRateLimitError } from "@/lib/market-data/errors";
import {
  recordProviderFailure as recordFailure,
  reserveProviderRequest,
} from "@/lib/market-data/budget";
import { configuredMarketDataProvider } from "@/lib/market-data/provider-registry";
import { isMarketDataStale } from "@/lib/market-data/cache";
import { resolveCanonicalSecurity } from "@/lib/market-data/security-resolver";
import type { SecurityLookup } from "@/lib/market-data/types";

const inFlight = new Map<string, Promise<void>>();
function json(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined
    ? Prisma.JsonNull
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

async function lookupForSecurity(
  securityId: string,
): Promise<SecurityLookup | null> {
  const security = await prisma.security.findUnique({
    where: { id: securityId },
  });
  if (!security) return null;
  const resolution = await resolveCanonicalSecurity(securityId);
  return {
    securityId,
    symbol: resolution.candidate?.symbol ?? null,
    name: security.name,
    exchange: security.exchange,
    currency: security.currency,
    securityType: security.securityType,
  };
}

export async function refreshQuoteForSecurity(
  securityId: string,
  force = false,
) {
  const key = `quote:${securityId}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = (async () => {
    const provider = configuredMarketDataProvider();
    if (!provider) return;
    const existing = await prisma.marketQuote.findUnique({
      where: { securityId_provider: { securityId, provider: provider.id } },
    });
    if (
      !force &&
      existing &&
      !isMarketDataStale(existing.retrievedAt) &&
      ["REAL_TIME", "DELAYED", "END_OF_DAY"].includes(existing.dataStatus)
    )
      return;
    const lookup = await lookupForSecurity(securityId);
    if (!lookup?.symbol) {
      await prisma.marketQuote.upsert({
        where: { securityId_provider: { securityId, provider: provider.id } },
        create: {
          securityId,
          provider: provider.id,
          dataStatus: "UNAVAILABLE",
          transformationMethod: "no_resolved_symbol",
          provenance: json({ reason: "unresolved_security" }),
        },
        update: {
          dataStatus: "UNAVAILABLE",
          retrievedAt: new Date(),
          transformationMethod: "no_resolved_symbol",
          provenance: json({ reason: "unresolved_security" }),
        },
      });
      return;
    }
    try {
      await reserveProviderRequest(provider.id);
      const result = await provider.getQuote(lookup);
      if (!result.ok) {
        if (result.code === "RATE_LIMITED")
          await recordFailure(provider.id, true);
        await prisma.marketQuote.upsert({
          where: { securityId_provider: { securityId, provider: provider.id } },
          create: {
            securityId,
            provider: provider.id,
            dataStatus: result.status,
            transformationMethod: "provider_error",
            provenance: json({ code: result.code, message: result.message }),
          },
          update: {
            dataStatus: result.status,
            retrievedAt: new Date(),
            transformationMethod: "provider_error",
            provenance: json({ code: result.code, message: result.message }),
          },
        });
        if (result.code === "RATE_LIMITED")
          throw new MarketDataRateLimitError(
            result.message,
            result.retryAfterMs,
          );
        return;
      }
      const quote = result.value;
      await prisma.marketQuote.upsert({
        where: { securityId_provider: { securityId, provider: provider.id } },
        create: {
          securityId,
          provider: provider.id,
          price: quote.price ?? null,
          currency: quote.currency ?? null,
          previousClose: quote.previousClose ?? null,
          change: quote.change ?? null,
          changePercent: quote.changePercent ?? null,
          marketTimestamp: quote.marketTimestamp ?? null,
          providerTimestamp: quote.providerTimestamp ?? null,
          dataStatus: quote.dataStatus,
          provenance: json(quote.provenance),
        },
        update: {
          price: quote.price ?? null,
          currency: quote.currency ?? null,
          previousClose: quote.previousClose ?? null,
          change: quote.change ?? null,
          changePercent: quote.changePercent ?? null,
          marketTimestamp: quote.marketTimestamp ?? null,
          providerTimestamp: quote.providerTimestamp ?? null,
          retrievedAt: new Date(),
          dataStatus: quote.dataStatus,
          provenance: json(quote.provenance),
        },
      });
    } catch (error) {
      await recordFailure(
        provider.id,
        error instanceof MarketDataRateLimitError,
      );
      throw error;
    }
  })();
  inFlight.set(key, task);
  try {
    await task;
  } finally {
    inFlight.delete(key);
  }
}

export async function backfillHistoricalPrices(securityId: string) {
  const provider = configuredMarketDataProvider();
  if (!provider) return;
  const lookup = await lookupForSecurity(securityId);
  if (!lookup?.symbol) return;
  await reserveProviderRequest(provider.id);
  const result = await provider.getHistoricalPrices(lookup, {
    adjusted: true,
    outputSize: "compact",
  });
  if (!result.ok) {
    await recordFailure(provider.id, result.code === "RATE_LIMITED");
    if (result.code === "RATE_LIMITED")
      throw new MarketDataRateLimitError(result.message, result.retryAfterMs);
    return;
  }
  // Keep transactions small enough for serverless Postgres and Prisma's query
  // parameter limits. This also means a single malformed provider row cannot
  // make an otherwise useful price refresh appear to hang.
  const batchSize = 100;
  for (let index = 0; index < result.value.length; index += batchSize) {
    const batch = result.value.slice(index, index + batchSize);
    await prisma.$transaction(
      batch.map((point) =>
        prisma.historicalPrice.upsert({
          where: {
            securityId_provider_tradingDate_isAdjusted: {
              securityId,
              provider: provider.id,
              tradingDate: point.tradingDate,
              isAdjusted: point.isAdjusted,
            },
          },
          create: {
            securityId,
            provider: provider.id,
            tradingDate: point.tradingDate,
            open: point.open ?? null,
            high: point.high ?? null,
            low: point.low ?? null,
            close: point.close ?? null,
            adjustedClose: point.adjustedClose ?? null,
            volume: point.volume ?? null,
            currency: point.currency ?? null,
            isAdjusted: point.isAdjusted,
            marketTimestamp: point.marketTimestamp ?? null,
            providerTimestamp: point.providerTimestamp ?? null,
            provenance: json(point.provenance),
          },
          update: {
            open: point.open ?? null,
            high: point.high ?? null,
            low: point.low ?? null,
            close: point.close ?? null,
            adjustedClose: point.adjustedClose ?? null,
            volume: point.volume ?? null,
            currency: point.currency ?? null,
            marketTimestamp: point.marketTimestamp ?? null,
            providerTimestamp: point.providerTimestamp ?? null,
            retrievedAt: new Date(),
            provenance: json(point.provenance),
          },
        }),
      ),
    );
  }
}

export async function enrichSecurity(securityId: string) {
  const provider = configuredMarketDataProvider();
  if (!provider) return;
  const lookup = await lookupForSecurity(securityId);
  if (!lookup?.symbol) return;
  await reserveProviderRequest(provider.id);
  const profile = await provider.getCompanyProfile(lookup);
  if (!profile.ok) {
    await recordFailure(provider.id, profile.code === "RATE_LIMITED");
    if (profile.code === "RATE_LIMITED")
      throw new MarketDataRateLimitError(profile.message, profile.retryAfterMs);
    return;
  }
  const value = profile.value;
  await prisma.$transaction([
    prisma.security.update({
      where: { id: securityId },
      data: {
        ...(value.sector ? { sector: value.sector } : {}),
        ...(value.industry ? { industry: value.industry } : {}),
        ...(value.country ? { country: value.country } : {}),
        ...(value.exchange ? { exchange: value.exchange } : {}),
      },
    }),
    prisma.securityEnrichment.upsert({
      where: { securityId_provider: { securityId, provider: provider.id } },
      create: {
        securityId,
        provider: provider.id,
        assetClass: value.assetClass ?? null,
        sector: value.sector ?? null,
        industry: value.industry ?? null,
        country: value.country ?? null,
        exchange: value.exchange ?? null,
        marketCap: value.marketCap ?? null,
        fundCategory: value.fundCategory ?? null,
        expenseRatio: value.expenseRatio ?? null,
        dividendYield: value.dividendYield ?? null,
        beta: value.beta ?? null,
        profile: json(value.profile),
        providerTimestamp: value.providerTimestamp ?? null,
        provenance: json({ endpoint: "OVERVIEW" }),
      },
      update: {
        assetClass: value.assetClass ?? null,
        sector: value.sector ?? null,
        industry: value.industry ?? null,
        country: value.country ?? null,
        exchange: value.exchange ?? null,
        marketCap: value.marketCap ?? null,
        fundCategory: value.fundCategory ?? null,
        expenseRatio: value.expenseRatio ?? null,
        dividendYield: value.dividendYield ?? null,
        beta: value.beta ?? null,
        profile: json(value.profile),
        providerTimestamp: value.providerTimestamp ?? null,
        retrievedAt: new Date(),
        provenance: json({ endpoint: "OVERVIEW" }),
      },
    }),
  ]);
  if (process.env.MARKET_DATA_INCLUDE_FINANCIALS === "true") {
    // Statement APIs require four additional requests. Make the cost explicit
    // and reserve budget before any provider calls begin.
    for (let request = 0; request < 4; request += 1)
      await reserveProviderRequest(provider.id);
    const fundamentals = await provider.getFundamentals(lookup);
    if (fundamentals.ok)
      await prisma.securityEnrichment.update({
        where: { securityId_provider: { securityId, provider: provider.id } },
        data: {
          fundamentals: json({
            incomeStatements: fundamentals.value.incomeStatements,
            balanceSheets: fundamentals.value.balanceSheets,
            cashFlows: fundamentals.value.cashFlows,
            valuationMetrics: fundamentals.value.valuationMetrics,
          }),
          providerTimestamp: fundamentals.value.providerTimestamp ?? new Date(),
          retrievedAt: new Date(),
          transformationMethod: "provider_normalized_with_financial_statements",
        },
      });
  }
}

export async function refreshCorporateEvents(securityId: string) {
  const provider = configuredMarketDataProvider();
  if (!provider) return;
  const lookup = await lookupForSecurity(securityId);
  if (!lookup?.symbol) return;
  await reserveProviderRequest(provider.id);
  const corporate = await provider.getCorporateEvents(lookup);
  if (!corporate.ok) {
    await recordFailure(provider.id, corporate.code === "RATE_LIMITED");
    if (corporate.code === "RATE_LIMITED")
      throw new MarketDataRateLimitError(
        corporate.message,
        corporate.retryAfterMs,
      );
    return;
  }
  await reserveProviderRequest(provider.id);
  const earnings = await provider.getEarningsCalendar(lookup);
  if (!earnings.ok && earnings.code === "RATE_LIMITED")
    throw new MarketDataRateLimitError(earnings.message, earnings.retryAfterMs);
  const events = earnings.ok
    ? [...corporate.value, ...earnings.value]
    : corporate.value;
  for (const event of events)
    await prisma.corporateEvent.upsert({
      where: {
        securityId_provider_type_eventDate_providerEventId: {
          securityId,
          provider: provider.id,
          type: event.type,
          eventDate: event.eventDate,
          providerEventId: event.providerEventId ?? "",
        },
      },
      create: {
        securityId,
        provider: provider.id,
        providerEventId: event.providerEventId ?? "",
        type: event.type,
        eventDate: event.eventDate,
        announcedAt: event.announcedAt ?? null,
        amount: event.amount ?? null,
        currency: event.currency ?? null,
        metadata: event.metadata ? json(event.metadata) : undefined,
        marketTimestamp: event.marketTimestamp ?? null,
        providerTimestamp: event.providerTimestamp ?? null,
      },
      update: {
        announcedAt: event.announcedAt ?? null,
        amount: event.amount ?? null,
        currency: event.currency ?? null,
        metadata: event.metadata ? json(event.metadata) : undefined,
        marketTimestamp: event.marketTimestamp ?? null,
        providerTimestamp: event.providerTimestamp ?? null,
        retrievedAt: new Date(),
      },
    });
}

export async function refreshRelevantNews(securityId: string) {
  const provider = configuredMarketDataProvider();
  if (!provider) return;
  const lookup = await lookupForSecurity(securityId);
  if (!lookup?.symbol) return;
  await reserveProviderRequest(provider.id);
  const result = await provider.getRelevantNews(lookup);
  if (!result.ok) {
    await recordFailure(provider.id, result.code === "RATE_LIMITED");
    if (result.code === "RATE_LIMITED")
      throw new MarketDataRateLimitError(result.message, result.retryAfterMs);
    return;
  }
  await prisma.$transaction(
    result.value.map((article) =>
      prisma.marketNewsItem.upsert({
        where: {
          securityId_provider_providerArticleId: {
            securityId,
            provider: provider.id,
            providerArticleId: article.providerArticleId,
          },
        },
        create: {
          securityId,
          provider: provider.id,
          providerArticleId: article.providerArticleId,
          sourceName: article.sourceName ?? null,
          sourceUrl: article.sourceUrl ?? null,
          headline: article.headline,
          summary: article.summary ?? null,
          publishedAt: article.publishedAt ?? null,
          providerTimestamp: article.providerTimestamp ?? null,
          metadata: article.metadata ? json(article.metadata) : undefined,
        },
        update: {
          sourceName: article.sourceName ?? null,
          sourceUrl: article.sourceUrl ?? null,
          headline: article.headline,
          summary: article.summary ?? null,
          publishedAt: article.publishedAt ?? null,
          providerTimestamp: article.providerTimestamp ?? null,
          retrievedAt: new Date(),
          metadata: article.metadata ? json(article.metadata) : undefined,
        },
      }),
    ),
  );
}
