import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { executePaperTrade, PaperTradingError } from "@/lib/paper-trading/service";
import { PaperQuoteError } from "@/lib/market-data/paper-quote";
import { MarketDataRateLimitError } from "@/lib/market-data/errors";
import { assertSameOrigin, assertRateLimit } from "@/lib/security/request-guards";

const tradeSchema = z.object({
  ticker: z.string().trim().min(1).max(15),
  type: z.enum(["BUY", "SELL"]),
  shares: z.union([z.string(), z.number()]),
  priceAtAction: z.union([z.string(), z.number()]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    assertRateLimit(`paper-trade:${user.id}`, 12, 60_000);
    const { id } = await params;
    const trade = tradeSchema.parse(await request.json());
    const result = await executePaperTrade({ userId: user.id, paperPortfolioId: id, ...trade });
    return NextResponse.json({ ok: true, cashUSD: result.cashAfter.toString() });
  } catch (error) {
    const status =
      error instanceof UnauthorizedError
        ? 401
        : error instanceof PaperTradingError
          ? error.status
          : error instanceof PaperQuoteError || error instanceof z.ZodError
            ? 400
            : error instanceof MarketDataRateLimitError
              ? 429
              : 500;
    const message =
      error instanceof PaperTradingError ||
      error instanceof PaperQuoteError ||
      error instanceof z.ZodError ||
      error instanceof MarketDataRateLimitError
        ? error.message
        : status === 401
          ? "Sign in to make simulated trades."
          : "Unable to record simulated trade.";
    return apiError(error, message, status);
  }
}
