import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { createPaperPortfolio, paperPortfolioSummary, PaperTradingError } from "@/lib/paper-trading/service";
import { assertSameOrigin } from "@/lib/security/request-guards";

const createSchema = z.object({
  name: z.string().trim().max(80).optional(),
  startingCashUSD: z.union([z.string(), z.number()]).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    const portfolios = await paperPortfolioSummary(user.id);
    return NextResponse.json({ portfolios: portfolios.map((item) => ({
      id: item.portfolio.id,
      name: item.portfolio.name,
      startingCashUSD: item.portfolio.startingCashUSD.toString(),
      createdAt: item.portfolio.createdAt,
      cashUSD: item.cash.toString(),
      totalValueUSD: item.totalValue?.toString() ?? null,
      priceCoverage: item.priced,
      positionCount: item.portfolio.positions.length,
    })) });
  } catch (error) {
    return apiError(error, error instanceof UnauthorizedError ? "Sign in to use paper trading." : "Unable to load paper portfolios.", error instanceof UnauthorizedError ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    const body = createSchema.parse(await request.json());
    const portfolio = await createPaperPortfolio({ userId: user.id, ...body });
    return NextResponse.json({ portfolio: { id: portfolio.id, name: portfolio.name } }, { status: 201 });
  } catch (error) {
    const status = error instanceof UnauthorizedError ? 401 : error instanceof PaperTradingError ? error.status : error instanceof z.ZodError ? 400 : 500;
    return apiError(error, error instanceof PaperTradingError || error instanceof z.ZodError ? error.message : status === 401 ? "Sign in to create a paper portfolio." : "Unable to create paper portfolio.", status);
  }
}
