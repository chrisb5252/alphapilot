import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

// Market data is only readable for securities the signed-in user owns through
// a holding or watchlist. This avoids turning security endpoints into a public
// quote proxy that could leak data or burn vendor budget.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    const { id } = await params;
    const security = await prisma.security.findFirst({
      where: {
        id,
        OR: [
          { holdings: { some: { account: { userId: user.id } } } },
          { watchlistSecurities: { some: { watchlist: { userId: user.id } } } },
        ],
      },
      include: {
        marketQuotes: { orderBy: { retrievedAt: "desc" } },
        marketResolutions: { orderBy: { updatedAt: "desc" } },
        enrichments: { orderBy: { retrievedAt: "desc" } },
        historicalPrices: { orderBy: { tradingDate: "desc" }, take: 260 },
        corporateEvents: { orderBy: { eventDate: "desc" }, take: 100 },
        marketNews: { orderBy: { publishedAt: "desc" }, take: 25 },
      },
    });
    if (!security)
      return NextResponse.json(
        { error: "Security not found." },
        { status: 404 },
      );
    return NextResponse.json(security);
  } catch (error) {
    return apiError(
      error,
      "Unable to load market data.",
      error instanceof UnauthorizedError ? 401 : 500,
    );
  }
}
