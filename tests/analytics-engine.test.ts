import { describe, expect, it } from "vitest";
import {
  analyzePortfolio,
  type CanonicalAnalysisHolding,
  type CanonicalPortfolioSnapshot,
} from "@/lib/portfolio/analytics-engine";

const snapshot = (
  holdings: Array<Partial<CanonicalAnalysisHolding>> = [],
): CanonicalPortfolioSnapshot => ({
  id: "snapshot",
  portfolioId: "portfolio",
  asOf: new Date("2026-01-02T00:00:00Z"),
  currency: "USD",
  cash: [],
  transactions: [],
  holdings: holdings.map((holding, index) => ({
    securityId: String(index),
    symbol: `S${index}`,
    name: `Security ${index}`,
    securityType: "STOCK",
    sector: "Technology",
    industry: null,
    country: "US",
    currency: "USD",
    accountId: "account",
    accountName: "Brokerage",
    marketValue: "100.00",
    costBasis: "80.00",
    currentPrice: "10",
    previousClose: "9",
    resolved: true,
    stale: false,
    ...holding,
  })),
});

describe("deterministic analytics engine", () => {
  it("handles an empty portfolio without inventing a return", () => {
    const result = analyzePortfolio(snapshot());
    expect(result.totals.totalMarketValue).toBe("0.0000");
    expect(result.totals.unrealizedGainLossPercent).toBeNull();
    expect(result.risk.status).toBe("INSUFFICIENT_DATA");
  });
  it("calculates concentration, cash, cost basis, income, and fees with decimal strings", () => {
    const input = snapshot([
      { symbol: "ONE", marketValue: "900.10", costBasis: "500.05" },
      { symbol: "TWO", marketValue: "99.90", costBasis: null },
    ]);
    input.cash = [{ accountId: "account", currency: "USD", amount: "10.00" }];
    input.transactions = [{ type: "DIVIDEND", amount: "12.34", fees: "0.12" }];
    const result = analyzePortfolio(input);
    expect(result.totals.totalMarketValue).toBe("1010.0000");
    expect(result.concentration.largestHoldingPercent).toBe("89.12");
    expect(result.totals.incomeReceived).toBe("12.3400");
    expect(result.totals.fees).toBe("0.1200");
  });
  it("does not return risk metrics until the historical fixture has sufficient coverage", () => {
    const result = analyzePortfolio({
      ...snapshot([{ marketValue: "100" }]),
      historicalReturns: Array.from({ length: 30 }, (_, index) =>
        index % 2 ? "0.01" : "-0.005",
      ),
    });
    expect(result.risk.status).toBe("AVAILABLE");
    expect(result.risk.annualizedVolatility).toBeDefined();
  });
});
