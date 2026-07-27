import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import {
  assertRateLimit,
  assertSameOrigin,
} from "@/lib/security/request-guards";
import {
  backfillHistoricalPrices,
  enrichSecurity,
  refreshCorporateEvents,
  refreshQuoteForSecurity,
} from "@/lib/market-data/service";
import { marketDataIsConfigured } from "@/lib/market-data/provider-registry";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    assertRateLimit(`market-refresh:${user.id}`, 3, 60_000);
    if (!marketDataIsConfigured())
      return NextResponse.json(
        { error: "Market data is not configured for this environment." },
        { status: 503 },
      );
    const { id } = await params;
    const owned = await prisma.security.findFirst({
      where: {
        id,
        OR: [
          { holdings: { some: { account: { userId: user.id } } } },
          { watchlistSecurities: { some: { watchlist: { userId: user.id } } } },
        ],
      },
      select: { id: true },
    });
    if (!owned)
      return NextResponse.json(
        { error: "Security not found." },
        { status: 404 },
      );

    // One user-initiated refresh is deliberately bounded and rate-limited. It
    // makes the initial experience immediate without becoming a quote proxy.
    await refreshQuoteForSecurity(id, true);
    await enrichSecurity(id);
    await backfillHistoricalPrices(id);
    await refreshCorporateEvents(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(
      error,
      error instanceof Error &&
        error.message.includes("Daily market-data budget")
        ? error.message
        : "Unable to refresh market data. Please try again shortly.",
      error instanceof UnauthorizedError ? 401 : 429,
    );
  }
}
