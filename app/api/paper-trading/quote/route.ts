import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { getPaperTradeQuote, PaperQuoteError } from "@/lib/market-data/paper-quote";
import { assertRateLimit } from "@/lib/security/request-guards";

const schema = z.object({ ticker: z.string().trim().min(1).max(15) });

export async function GET(request: Request) {
  try {
    const user = await getCurrentAppUser();
    assertRateLimit(`paper-quote:${user.id}`, 8, 60_000);
    const ticker = schema.parse({ ticker: new URL(request.url).searchParams.get("ticker") }).ticker;
    const quote = await getPaperTradeQuote(ticker);
    return NextResponse.json({ quote: { ...quote, retrievedAt: quote.retrievedAt?.toISOString() ?? null } });
  } catch (error) {
    const status = error instanceof UnauthorizedError ? 401 : error instanceof PaperQuoteError || error instanceof z.ZodError ? 400 : 502;
    return apiError(error, error instanceof PaperQuoteError || error instanceof z.ZodError ? error.message : status === 401 ? "Sign in to retrieve quotes." : "Unable to retrieve a market quote.", status);
  }
}
