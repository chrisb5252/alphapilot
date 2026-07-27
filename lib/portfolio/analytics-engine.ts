import { Decimal } from "@prisma/client/runtime/client";

export const ANALYTICS_ENGINE_VERSION = "1.0.0";
export const ANALYTICS_FORMULA_VERSION = "2026-07-28";
const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

export type CanonicalAnalysisHolding = {
  securityId: string;
  symbol: string | null;
  name: string;
  securityType: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  currency: string;
  accountId: string;
  accountName: string;
  marketValue: string;
  costBasis: string | null;
  currentPrice: string | null;
  previousClose: string | null;
  resolved: boolean;
  stale: boolean;
};
export type CanonicalPortfolioSnapshot = {
  id: string;
  portfolioId: string;
  asOf: Date;
  currency: string;
  holdings: CanonicalAnalysisHolding[];
  cash: Array<{ accountId: string; currency: string; amount: string }>;
  transactions: Array<{ type: string; amount: string; fees: string | null }>;
  benchmark?: { key: string; symbol: string; returns: string[] };
  historicalReturns?: string[];
};
type Allocation = { label: string; value: string; percentage: string };
const d = (value: string | null | undefined) => new Decimal(value ?? 0);
const percent = (part: Decimal, total: Decimal) =>
  total.eq(0) ? ZERO : part.div(total).mul(HUNDRED);
const out = (value: Decimal, places = 4) =>
  value.toDecimalPlaces(places).toFixed(places);

function group(
  holdings: CanonicalAnalysisHolding[],
  total: Decimal,
  key: (holding: CanonicalAnalysisHolding) => string,
): Allocation[] {
  const values = new Map<string, Decimal>();
  for (const holding of holdings) {
    const label = key(holding);
    values.set(label, (values.get(label) ?? ZERO).plus(d(holding.marketValue)));
  }
  return [...values.entries()]
    .map(([label, value]) => ({
      label,
      value: out(value),
      percentage: out(percent(value, total), 2),
    }))
    .sort((a, b) => new Decimal(b.value).cmp(a.value));
}

function riskMetric(returns: string[] | undefined) {
  if (!returns || returns.length < 30)
    return {
      status: "INSUFFICIENT_DATA" as const,
      coveragePercent: "0.00",
      explanation: "At least 30 aligned periodic returns are required.",
    };
  const values = returns.map(d);
  const mean = values
    .reduce((sum, value) => sum.plus(value), ZERO)
    .div(values.length);
  const variance = values
    .reduce((sum, value) => sum.plus(value.minus(mean).pow(2)), ZERO)
    .div(values.length - 1);
  const volatility = variance.sqrt().mul(new Decimal(252).sqrt());
  const downside = values.filter((value) => value.lt(0));
  const downsideDeviation = downside.length
    ? downside
        .reduce((sum, value) => sum.plus(value.pow(2)), ZERO)
        .div(downside.length)
        .sqrt()
        .mul(new Decimal(252).sqrt())
    : ZERO;
  let wealth = new Decimal(1),
    peak = new Decimal(1),
    maxDrawdown = ZERO;
  for (const value of values) {
    wealth = wealth.mul(value.plus(1));
    if (wealth.gt(peak)) peak = wealth;
    const drawdown = wealth.div(peak).minus(1);
    if (drawdown.lt(maxDrawdown)) maxDrawdown = drawdown;
  }
  const sortedReturns = [...values].sort((a, b) => a.cmp(b));
  const var95 =
    sortedReturns[Math.max(0, Math.floor(values.length * 0.05) - 1)].abs();
  const tail = values.filter((value) => value.lte(var95.neg()));
  const cvar95 = tail.length
    ? tail.reduce((sum, value) => sum.plus(value.abs()), ZERO).div(tail.length)
    : var95;
  return {
    status: "AVAILABLE" as const,
    coveragePercent: "100.00",
    period: `${values.length} daily observations`,
    samplingFrequency: "daily",
    assumptions: [
      "Returns are simple daily returns",
      "252 trading days per year",
      "95% historical VaR",
    ],
    annualizedVolatility: out(volatility, 6),
    downsideDeviation: out(downsideDeviation, 6),
    maximumDrawdown: out(maxDrawdown, 6),
    valueAtRisk95: out(var95, 6),
    conditionalValueAtRisk95: out(cvar95, 6),
    explanation:
      "Educational historical estimate based only on the supplied aligned price history.",
  };
}

export type PortfolioAnalysis = ReturnType<typeof analyzePortfolio>;
export function analyzePortfolio(snapshot: CanonicalPortfolioSnapshot) {
  const holdings = snapshot.holdings.filter((holding) =>
    d(holding.marketValue).gt(0),
  );
  const investedValue = holdings.reduce(
    (sum, holding) => sum.plus(d(holding.marketValue)),
    ZERO,
  );
  const cashValue = snapshot.cash.reduce(
    (sum, cash) => sum.plus(d(cash.amount)),
    ZERO,
  );
  const totalValue = investedValue.plus(cashValue);
  const totalCostBasis = holdings.reduce(
    (sum, holding) => sum.plus(d(holding.costBasis)),
    ZERO,
  );
  const costCoveredValue = holdings
    .filter((holding) => holding.costBasis !== null)
    .reduce((sum, holding) => sum.plus(d(holding.marketValue)), ZERO);
  const daily = holdings
    .filter((holding) => holding.currentPrice && holding.previousClose)
    .reduce(
      (sum, holding) =>
        sum.plus(d(holding.currentPrice).minus(d(holding.previousClose))),
      ZERO,
    );
  const income = snapshot.transactions
    .filter((transaction) =>
      ["DIVIDEND", "INTEREST"].includes(transaction.type),
    )
    .reduce((sum, transaction) => sum.plus(d(transaction.amount)), ZERO);
  const fees = snapshot.transactions.reduce(
    (sum, transaction) => sum.plus(d(transaction.fees)),
    ZERO,
  );
  const securityAllocation = group(
    holdings,
    totalValue,
    (holding) => holding.symbol ?? holding.name,
  );
  const sectorAllocation = group(
    holdings,
    totalValue,
    (holding) => holding.sector ?? "Unknown sector",
  );
  const top = [...securityAllocation].sort((a, b) =>
    new Decimal(b.percentage).cmp(a.percentage),
  );
  const sumTop = (count: number) =>
    top
      .slice(0, count)
      .reduce((sum, item) => sum.plus(d(item.percentage)), ZERO);
  const hhi = securityAllocation.reduce(
    (sum, item) => sum.plus(d(item.percentage).div(100).pow(2)),
    ZERO,
  );
  const largest = d(top[0]?.percentage);
  const largestSector = d(sectorAllocation[0]?.percentage);
  const knownSectorValue = holdings
    .filter((holding) => holding.sector)
    .reduce((sum, holding) => sum.plus(d(holding.marketValue)), ZERO);
  const unresolvedValue = holdings
    .filter((holding) => !holding.resolved)
    .reduce((sum, holding) => sum.plus(d(holding.marketValue)), ZERO);
  const score = Decimal.max(
    0,
    Decimal.min(
      100,
      new Decimal(100)
        .minus(Decimal.max(0, largest.minus(10)).mul(0.9))
        .minus(Decimal.max(0, sumTop(3).minus(35)).mul(0.35))
        .minus(Decimal.max(0, largestSector.minus(30)).mul(0.45))
        .minus(percent(unresolvedValue, totalValue).mul(0.15))
        .plus(Decimal.min(10, holdings.length)),
    ),
  );
  const warnings = [
    ...(largest.gte(25)
      ? [
          {
            type: "SINGLE_SECURITY",
            severity: largest.gte(40) ? "HIGH" : "MEDIUM",
            value: out(largest, 2),
          },
        ]
      : []),
    ...(largestSector.gte(40)
      ? [
          {
            type: "SECTOR",
            severity: largestSector.gte(60) ? "HIGH" : "MEDIUM",
            value: out(largestSector, 2),
          },
        ]
      : []),
  ];
  const dailyBase = holdings
    .filter((holding) => holding.previousClose)
    .reduce((sum, holding) => sum.plus(d(holding.previousClose)), ZERO);
  return {
    engineVersion: ANALYTICS_ENGINE_VERSION,
    formulaVersion: ANALYTICS_FORMULA_VERSION,
    portfolioSnapshotId: snapshot.id,
    dataTimestamp: snapshot.asOf.toISOString(),
    benchmark: snapshot.benchmark
      ? {
          key: snapshot.benchmark.key,
          symbol: snapshot.benchmark.symbol,
          status: "INSUFFICIENT_DATA",
        }
      : { key: "NONE", status: "NOT_CONFIGURED" },
    totals: {
      totalMarketValue: out(totalValue),
      investedValue: out(investedValue),
      cashValue: out(cashValue),
      totalCostBasis: out(totalCostBasis),
      unrealizedGainLoss: out(investedValue.minus(totalCostBasis)),
      unrealizedGainLossPercent: totalCostBasis.eq(0)
        ? null
        : out(percent(investedValue.minus(totalCostBasis), totalCostBasis), 2),
      dailyChange: dailyBase.eq(0) ? null : out(daily),
      dailyChangePercent: dailyBase.eq(0)
        ? null
        : out(percent(daily, dailyBase), 2),
      incomeReceived: out(income),
      fees: out(fees),
    },
    allocation: {
      assetClass: group(
        holdings,
        totalValue,
        (holding) => holding.securityType,
      ),
      sector: sectorAllocation,
      industry: group(
        holdings,
        totalValue,
        (holding) => holding.industry ?? "Unknown industry",
      ),
      country: group(
        holdings,
        totalValue,
        (holding) => holding.country ?? "Unknown country",
      ),
      currency: group(holdings, totalValue, (holding) => holding.currency),
      account: group(holdings, totalValue, (holding) => holding.accountName),
      security: securityAllocation,
      cash: snapshot.cash.map((cash) => ({
        label: cash.currency,
        value: out(d(cash.amount)),
        percentage: out(percent(d(cash.amount), totalValue), 2),
      })),
    },
    concentration: {
      largestHoldingPercent: out(largest, 2),
      top3Percent: out(sumTop(3), 2),
      top5Percent: out(sumTop(5), 2),
      top10Percent: out(sumTop(10), 2),
      herfindahlHirschmanIndex: out(hhi, 6),
      warnings,
    },
    diversification: {
      score: out(score, 0),
      subscores: {
        singleSecurity: out(
          Decimal.max(
            0,
            new Decimal(100).minus(Decimal.max(0, largest.minus(10)).mul(0.9)),
          ),
          2,
        ),
        sector: out(
          Decimal.max(
            0,
            new Decimal(100).minus(
              Decimal.max(0, largestSector.minus(30)).mul(0.45),
            ),
          ),
          2,
        ),
        breadth: out(Decimal.min(10, holdings.length), 2),
        dataQuality: out(
          Decimal.max(
            0,
            new Decimal(100).minus(percent(unresolvedValue, totalValue)),
          ),
          2,
        ),
      },
      limitations: [
        "ETF and mutual-fund exposures are treated as their own holdings; no look-through is claimed.",
        "Cash contributes to total value but is excluded from security concentration.",
        "Unknown and unresolved classifications reduce data-quality coverage.",
      ],
    },
    exposure: {
      technologyPercent: out(
        percent(
          holdings
            .filter((holding) => holding.sector === "Technology")
            .reduce((sum, holding) => sum.plus(d(holding.marketValue)), ZERO),
          totalValue,
        ),
        2,
      ),
      aiRelated: {
        status: "NOT_AVAILABLE",
        taxonomyVersion: "2026-07-28",
        explanation:
          "No AI classification source has been supplied for these securities.",
      },
      directOnly: true,
    },
    risk: riskMetric(snapshot.historicalReturns),
    dataQuality: {
      portfolioCoveragePercent: "100.00",
      priceCoveragePercent: out(
        percent(
          holdings
            .filter((holding) => holding.currentPrice)
            .reduce((sum, holding) => sum.plus(d(holding.marketValue)), ZERO),
          totalValue,
        ),
        2,
      ),
      costBasisCoveragePercent: out(percent(costCoveredValue, totalValue), 2),
      sectorCoveragePercent: out(percent(knownSectorValue, totalValue), 2),
      historicalDataCoveragePercent: snapshot.historicalReturns?.length
        ? "100.00"
        : "0.00",
      unresolvedHoldings: holdings
        .filter((holding) => !holding.resolved)
        .map((holding) => holding.symbol ?? holding.name),
      staleHoldings: holdings
        .filter((holding) => holding.stale)
        .map((holding) => holding.symbol ?? holding.name),
      assumptions: [
        "Values are from the canonical snapshot",
        "No currency conversion is performed without FX data",
      ],
      warnings: warnings.map((warning) => warning.type),
    },
  };
}
