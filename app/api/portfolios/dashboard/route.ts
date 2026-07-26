import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { buildDashboard } from "@/lib/portfolio/dashboard";

export async function GET(request: Request) {
  try {
    const user = await getCurrentAppUser();
    const portfolioId = new URL(request.url).searchParams.get("portfolioId");
    const portfolios = await prisma.portfolio.findMany({ where: { userId: user.id }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" } });
    const chosen = portfolioId ? portfolios.find((portfolio) => portfolio.id === portfolioId) : portfolios[0];
    if (!chosen) return NextResponse.json({ portfolios, dashboard: null });
    const imported = await prisma.importHistory.findFirst({ where: { portfolioId: chosen.id, isActive: true, status: "COMPLETED" }, include: { holdings: true }, orderBy: { importedAt: "desc" } });
    return NextResponse.json({ portfolios, dashboard: imported ? buildDashboard(imported.holdings, chosen.name, imported.id, imported.importedAt) : null });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ portfolios: [], dashboard: null });
    return NextResponse.json({ error: "Unable to load your portfolio." }, { status: 500 });
  }
}
