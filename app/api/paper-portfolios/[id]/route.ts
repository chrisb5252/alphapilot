import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { paperPortfolioView, PaperTradingError } from "@/lib/paper-trading/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentAppUser();
    const { id } = await params;
    const view = await paperPortfolioView(user.id, id);
    return NextResponse.json({
      portfolio: {
        id: view.portfolio.id, name: view.portfolio.name, startingCashUSD: view.portfolio.startingCashUSD.toString(), createdAt: view.portfolio.createdAt,
        cashUSD: view.cash.toString(), totalValueUSD: view.totalValue?.toString() ?? null, priceCoverage: view.allPricesAvailable,
        positions: view.positions.map((position) => ({ ticker: position.ticker, shares: position.shares.toString(), avgCostBasis: position.avgCostBasis.toString(), currentPrice: position.currentPrice?.toString() ?? null, marketValue: position.marketValue?.toString() ?? null, gainLoss: position.gainLoss?.toString() ?? null, quoteStatus: position.quote?.status ?? "UNAVAILABLE", quoteRetrievedAt: position.quote?.retrievedAt ?? null })),
        snapshots: view.portfolio.snapshots.map((snapshot) => ({ timestamp: snapshot.timestamp, totalValueUSD: snapshot.totalValueUSD.toString(), cashUSD: snapshot.cashUSD.toString() })),
      },
    });
  } catch (error) {
    const status = error instanceof UnauthorizedError ? 401 : error instanceof PaperTradingError ? error.status : 500;
    return apiError(error, error instanceof PaperTradingError ? error.message : status === 401 ? "Sign in to access paper trading." : "Unable to load paper portfolio.", status);
  }
}
