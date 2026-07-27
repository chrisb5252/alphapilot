import { prisma } from "@/lib/prisma";
import { MarketDataRateLimitError } from "@/lib/market-data/errors";
import {
  backfillHistoricalPrices,
  enrichSecurity,
  refreshCorporateEvents,
  refreshQuoteForSecurity,
} from "@/lib/market-data/service";
import { resolveCanonicalSecurity } from "@/lib/market-data/security-resolver";
import type { MarketDataJobType } from "@/generated/prisma/client";

const jobTypes: MarketDataJobType[] = [
  "SECURITY_ENRICHMENT",
  "QUOTE_REFRESH",
  "HISTORICAL_PRICE_BACKFILL",
  "CORPORATE_EVENT_REFRESH",
  "RESOLUTION_RETRY",
];

export async function queueSecurityMarketDataJobs(input: {
  securityIds: string[];
  userId?: string;
  portfolioId?: string;
}) {
  const uniqueSecurityIds = [...new Set(input.securityIds)];
  if (!uniqueSecurityIds.length) return;
  const existing = await prisma.marketDataJob.findMany({
    where: {
      securityId: { in: uniqueSecurityIds },
      type: { in: jobTypes },
      status: { in: ["PENDING", "RUNNING"] },
    },
    select: { securityId: true, type: true },
  });
  const active = new Set(
    existing.map((job) => `${job.securityId}:${job.type}`),
  );
  await prisma.marketDataJob.createMany({
    data: uniqueSecurityIds.flatMap((securityId) =>
      jobTypes
        .filter((type) => !active.has(`${securityId}:${type}`))
        .map((type) => ({
          securityId,
          userId: input.userId ?? null,
          portfolioId: input.portfolioId ?? null,
          type,
        })),
    ),
  });
}

function backoff(attempts: number) {
  return Math.min(24 * 60 * 60_000, 60_000 * 2 ** Math.min(attempts, 10));
}

async function execute(type: MarketDataJobType, securityId: string) {
  switch (type) {
    case "SECURITY_ENRICHMENT":
      return enrichSecurity(securityId);
    case "QUOTE_REFRESH":
      return refreshQuoteForSecurity(securityId);
    case "HISTORICAL_PRICE_BACKFILL":
      return backfillHistoricalPrices(securityId);
    case "CORPORATE_EVENT_REFRESH":
      return refreshCorporateEvents(securityId);
    case "RESOLUTION_RETRY":
      return resolveCanonicalSecurity(securityId).then(() => undefined);
  }
}

export async function processMarketDataJobs(limit = 4) {
  const jobs = await prisma.marketDataJob.findMany({
    where: { status: "PENDING", notBefore: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const job of jobs) {
    if (!job.securityId) continue;
    await prisma.marketDataJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    try {
      await execute(job.type, job.securityId);
      await prisma.marketDataJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      processed += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const retriable =
        error instanceof MarketDataRateLimitError || attempts < 5;
      await prisma.marketDataJob.update({
        where: { id: job.id },
        data: retriable
          ? {
              status: "PENDING",
              notBefore: new Date(
                Date.now() +
                  (error instanceof MarketDataRateLimitError
                    ? (error.retryAfterMs ?? backoff(attempts))
                    : backoff(attempts)),
              ),
              errorCode:
                error instanceof MarketDataRateLimitError
                  ? error.code
                  : "PROVIDER_ERROR",
              errorMessage:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : "Market-data job failed.",
            }
          : {
              status: "FAILED",
              completedAt: new Date(),
              errorCode: "RETRY_EXHAUSTED",
              errorMessage:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : "Market-data job failed.",
            },
      });
    }
  }
  return { processed, queued: jobs.length - processed };
}
