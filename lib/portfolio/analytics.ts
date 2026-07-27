export type AnalyticsHolding = {
  id: string;
  symbol: string;
  name: string;
  sector: string | null;
  securityType: string;
  marketValue: number;
  costBasis: number | null;
};

export type PortfolioAnalytics = {
  asOf: "imported_holdings";
  diversificationScore: number;
  concentration: {
    topHoldingPercent: number | null;
    topThreePercent: number | null;
    largestSectorPercent: number | null;
  };
  assetAllocation: Array<{ label: string; value: number; percentage: number }>;
  topHoldings: Array<AnalyticsHolding & { percentage: number }>;
  dataQuality: {
    costBasisCoveragePercent: number;
    classifiedValuePercent: number;
    message: string;
  };
  insights: Array<{
    id: string;
    severity: "INFO" | "LOW" | "MEDIUM" | "HIGH";
    title: string;
    summary: string;
  }>;
  researchAreas: string[];
};

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

const labels: Record<string, string> = {
  STOCK: "Stocks",
  ETF: "ETFs",
  MUTUAL_FUND: "Mutual funds",
  FIXED_INCOME: "Fixed income",
  OPTION: "Options",
  CRYPTO: "Crypto",
  CASH: "Cash",
  OTHER: "Other",
};

function allocation(
  holdings: AnalyticsHolding[],
  key: (holding: AnalyticsHolding) => string,
  totalValue: number,
) {
  const values = new Map<string, number>();
  for (const holding of holdings) {
    const label = key(holding);
    values.set(label, (values.get(label) ?? 0) + holding.marketValue);
  }
  return [...values.entries()]
    .map(([label, value]) => ({
      label,
      value: round(value, 2),
      percentage: totalValue ? round((value / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Deterministic, educational portfolio analysis. It intentionally uses only
 * imported holding values and classifications; it never fetches prices, news,
 * benchmarks, or produces trading actions.
 */
export function buildPortfolioAnalytics(
  rawHoldings: AnalyticsHolding[],
): PortfolioAnalytics {
  const holdings = rawHoldings.filter((holding) => holding.marketValue > 0);
  const totalValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );
  const topHoldings = [...holdings]
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, 5)
    .map((holding) => ({
      ...holding,
      percentage: totalValue
        ? round((holding.marketValue / totalValue) * 100)
        : 0,
    }));
  const sectorAllocation = allocation(
    holdings,
    (holding) => holding.sector || "Unclassified",
    totalValue,
  );
  const assetAllocation = allocation(
    holdings,
    (holding) => labels[holding.securityType] ?? "Other",
    totalValue,
  );
  const topHoldingPercent = topHoldings[0]?.percentage ?? null;
  const topThreePercent = totalValue
    ? round(
        (topHoldings
          .slice(0, 3)
          .reduce((sum, holding) => sum + holding.marketValue, 0) /
          totalValue) *
          100,
      )
    : null;
  const largestSectorPercent = sectorAllocation[0]?.percentage ?? null;
  const classifiedValue = holdings
    .filter((holding) => holding.sector)
    .reduce((sum, holding) => sum + holding.marketValue, 0);
  const withCostBasis = holdings
    .filter((holding) => holding.costBasis !== null)
    .reduce((sum, holding) => sum + holding.marketValue, 0);
  const classifiedValuePercent = totalValue
    ? round((classifiedValue / totalValue) * 100)
    : 0;
  const costBasisCoveragePercent = totalValue
    ? round((withCostBasis / totalValue) * 100)
    : 0;

  // The score is a transparent composition signal, not a risk rating or a
  // recommendation. Concentration is deliberately weighted more heavily than
  // number of line items, which avoids rewarding many tiny positions.
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          Math.max(0, (topHoldingPercent ?? 0) - 10) * 0.9 -
          Math.max(0, (topThreePercent ?? 0) - 35) * 0.35 -
          Math.max(0, (largestSectorPercent ?? 0) - 30) * 0.45 -
          Math.max(0, 60 - classifiedValuePercent) * 0.15 +
          Math.min(10, holdings.length),
      ),
    ),
  );

  const insights: PortfolioAnalytics["insights"] = [];
  const researchAreas: string[] = [];
  if (topHoldingPercent !== null && topHoldingPercent >= 25) {
    insights.push({
      id: "single-holding-concentration",
      severity: topHoldingPercent >= 40 ? "HIGH" : "MEDIUM",
      title: "Single-holding concentration",
      summary: `${topHoldings[0].symbol} represents ${topHoldingPercent}% of the imported portfolio value. Research how its business, industry, and major risks influence the overall portfolio.`,
    });
    researchAreas.push(
      `Understand the business and key risks of ${topHoldings[0].symbol}.`,
    );
  }
  if (topThreePercent !== null && topThreePercent >= 60) {
    insights.push({
      id: "top-three-concentration",
      severity: "MEDIUM",
      title: "Top positions drive most exposure",
      summary: `The three largest holdings account for ${topThreePercent}% of imported portfolio value. Their shared drivers may matter more than the number of positions suggests.`,
    });
  }
  if (largestSectorPercent !== null && largestSectorPercent >= 40) {
    insights.push({
      id: "sector-concentration",
      severity: largestSectorPercent >= 60 ? "HIGH" : "MEDIUM",
      title: "Sector exposure is concentrated",
      summary: `${sectorAllocation[0].label} represents ${largestSectorPercent}% of imported portfolio value. Review how economic or industry-specific changes could affect several positions together.`,
    });
    researchAreas.push(
      `Review the main risks and economic drivers for ${sectorAllocation[0].label}.`,
    );
  }
  if (classifiedValuePercent < 80) {
    insights.push({
      id: "classification-coverage",
      severity: "LOW",
      title: "Some holdings need classification",
      summary: `${round(100 - classifiedValuePercent)}% of imported value has no sector classification, so sector exposure is incomplete.`,
    });
    researchAreas.push(
      "Identify the asset class and sector for unclassified holdings.",
    );
  }
  if (costBasisCoveragePercent < 80) {
    insights.push({
      id: "cost-basis-coverage",
      severity: "INFO",
      title: "Cost-basis information is incomplete",
      summary: `Cost basis is available for ${costBasisCoveragePercent}% of imported value. Gain/loss context may be incomplete until the missing information is imported.`,
    });
    researchAreas.push(
      "Confirm cost basis for positions without it before relying on gain/loss totals.",
    );
  }
  if (!insights.length)
    insights.push({
      id: "portfolio-coverage",
      severity: "INFO",
      title: "Portfolio composition is available",
      summary:
        "Review the largest holdings, asset mix, and sectors over time. This analysis reflects imported holdings only and is not investment advice.",
    });

  return {
    asOf: "imported_holdings",
    diversificationScore: score,
    concentration: { topHoldingPercent, topThreePercent, largestSectorPercent },
    assetAllocation,
    topHoldings,
    dataQuality: {
      costBasisCoveragePercent,
      classifiedValuePercent,
      message:
        "Analysis uses imported holdings and their recorded values. Live prices, benchmark returns, news, and correlation data are not included.",
    },
    insights,
    researchAreas: [...new Set(researchAreas)].slice(0, 4),
  };
}
