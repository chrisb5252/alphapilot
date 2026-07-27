import { prisma } from "@/lib/prisma";
export async function getPortfolioDashboardData(
  userId: string,
  portfolioId: string,
) {
  return prisma.holding.findMany({
    where: { account: { portfolioId, userId, isIncludedInAnalysis: true } },
    include: { security: true, account: true },
    orderBy: { marketValue: "desc" },
  });
}
export async function getOwnedPortfolio(userId: string, portfolioId: string) {
  return prisma.portfolio.findFirst({ where: { id: portfolioId, userId } });
}
