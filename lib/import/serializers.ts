import type { Holding } from "@/generated/prisma/client";

export function holdingToInput(holding: Holding) {
  return { symbol: holding.symbol, companyName: holding.companyName ?? "", sector: holding.sector ?? "", shares: Number(holding.shares), costBasis: holding.costBasis === null ? null : Number(holding.costBasis), currentPrice: holding.currentPrice === null ? null : Number(holding.currentPrice), marketValue: Number(holding.marketValue) };
}
