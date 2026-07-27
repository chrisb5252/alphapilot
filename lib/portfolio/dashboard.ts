import type { Holding, Security } from "@/generated/prisma/client";
const number = (value: unknown) => Number(value);
export function buildDashboard(
  holdings: Array<Holding & { security: Security }>,
  portfolioName: string,
  importId: string,
  importedAt: Date,
) {
  const totalValue = holdings.reduce(
    (sum, holding) => sum + number(holding.marketValue),
    0,
  );
  const totalCost = holdings.reduce(
    (sum, holding) =>
      sum + (holding.costBasis === null ? 0 : number(holding.costBasis)),
    0,
  );
  const allocationMap = new Map<string, number>();
  holdings.forEach((holding) => {
    const sector = holding.security.sector || "Unclassified";
    allocationMap.set(
      sector,
      (allocationMap.get(sector) ?? 0) + number(holding.marketValue),
    );
  });
  const allocation = [...allocationMap.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percentage: totalValue ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
  const topWeight =
    holdings.length && totalValue
      ? (Math.max(...holdings.map((holding) => number(holding.marketValue))) /
          totalValue) *
        100
      : 0;
  const diversificationScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          topWeight * 1.1 -
          Math.max(0, (allocation[0]?.percentage ?? 0) - 30) * 0.55 +
          Math.min(holdings.length, 12),
      ),
    ),
  );
  return {
    portfolio: {
      id: importId,
      name: portfolioName,
      importedAt,
      totalValue,
      totalCost,
      totalGain: totalValue - totalCost,
      totalGainPercent: totalCost
        ? ((totalValue - totalCost) / totalCost) * 100
        : null,
      diversificationScore,
      holdingCount: holdings.length,
    },
    holdings: holdings.map((holding) => ({
      id: holding.id,
      symbol: holding.security.canonicalSymbol ?? holding.security.name,
      companyName: holding.security.name,
      sector: holding.security.sector,
      shares: number(holding.quantity),
      costBasis: holding.costBasis === null ? null : number(holding.costBasis),
      currentPrice:
        holding.currentPrice === null ? null : number(holding.currentPrice),
      marketValue: number(holding.marketValue),
      allocationPercent: totalValue
        ? (number(holding.marketValue) / totalValue) * 100
        : 0,
    })),
    allocation,
  };
}
