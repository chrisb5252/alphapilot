import { prisma } from "@/lib/prisma";
import { MarketDataRateLimitError } from "@/lib/market-data/errors";
import type { MarketDataProviderId } from "@/lib/market-data/types";

const dayMs = 86_400_000;
const dailyLimit = Number(process.env.MARKET_DATA_DAILY_REQUEST_LIMIT ?? "25");

function dayStart(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function reserveProviderRequest(provider: MarketDataProviderId) {
  const usageDate = dayStart();
  const current = await prisma.marketDataUsage.findUnique({
    where: { provider_usageDate: { provider, usageDate } },
  });
  if ((current?.requestCount ?? 0) >= dailyLimit)
    throw new MarketDataRateLimitError(
      "Daily market-data budget reached. Data will refresh automatically tomorrow.",
      dayMs - (Date.now() - usageDate.valueOf()),
    );
  await prisma.marketDataUsage.upsert({
    where: { provider_usageDate: { provider, usageDate } },
    create: { provider, usageDate, requestCount: 1 },
    update: { requestCount: { increment: 1 } },
  });
}

export async function recordProviderFailure(
  provider: MarketDataProviderId,
  rateLimited = false,
) {
  const usageDate = dayStart();
  await prisma.marketDataUsage.upsert({
    where: { provider_usageDate: { provider, usageDate } },
    create: {
      provider,
      usageDate,
      failedCount: rateLimited ? 0 : 1,
      rateLimitedCount: rateLimited ? 1 : 0,
    },
    update: rateLimited
      ? { rateLimitedCount: { increment: 1 } }
      : { failedCount: { increment: 1 } },
  });
}
