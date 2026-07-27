import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { recalculatePortfolioAnalysis } from "@/lib/portfolio/analysis-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      benchmark?: { key?: string; symbol?: string };
    };
    const benchmark =
      body.benchmark?.key && body.benchmark.symbol
        ? { key: body.benchmark.key, symbol: body.benchmark.symbol }
        : undefined;
    const analysis = await recalculatePortfolioAnalysis({
      userId: user.id,
      portfolioId: id,
      benchmark,
    });
    if (!analysis)
      return NextResponse.json(
        { error: "Portfolio not found." },
        { status: 404 },
      );
    return NextResponse.json(analysis, { status: 201 });
  } catch (error) {
    return apiError(
      error,
      "Unable to calculate portfolio analysis.",
      error instanceof UnauthorizedError ? 401 : 500,
    );
  }
}
