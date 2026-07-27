import { describe, expect, it } from "vitest";
import { buildPortfolioAnalytics } from "@/lib/portfolio/analytics";

describe("portfolio analytics", () => {
  it("flags transparent holding and sector concentration", () => {
    const result = buildPortfolioAnalytics([
      {
        id: "1",
        symbol: "AAPL",
        name: "Apple",
        sector: "Technology",
        securityType: "STOCK",
        marketValue: 600,
        costBasis: 500,
      },
      {
        id: "2",
        symbol: "MSFT",
        name: "Microsoft",
        sector: "Technology",
        securityType: "STOCK",
        marketValue: 250,
        costBasis: 200,
      },
      {
        id: "3",
        symbol: "BND",
        name: "Vanguard Bond",
        sector: null,
        securityType: "ETF",
        marketValue: 150,
        costBasis: null,
      },
    ]);
    expect(result.concentration).toMatchObject({
      topHoldingPercent: 60,
      topThreePercent: 100,
      largestSectorPercent: 85,
    });
    expect(result.insights.map((insight) => insight.id)).toContain(
      "single-holding-concentration",
    );
    expect(result.dataQuality).toMatchObject({
      costBasisCoveragePercent: 85,
      classifiedValuePercent: 85,
    });
  });

  it("does not invent missing market data or recommendations", () => {
    const result = buildPortfolioAnalytics([
      {
        id: "1",
        symbol: "FUND",
        name: "Fund",
        sector: null,
        securityType: "MUTUAL_FUND",
        marketValue: 100,
        costBasis: null,
      },
    ]);
    expect(result.dataQuality.message).toContain("Live prices");
    expect(result.insights.map((insight) => insight.id)).toContain(
      "classification-coverage",
    );
    expect(result.researchAreas.join(" ")).not.toMatch(/buy|sell|rebalance/i);
  });
});
