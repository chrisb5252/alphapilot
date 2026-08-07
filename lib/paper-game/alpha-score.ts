import { Prisma } from "@/generated/prisma/client";

export const ALPHA_SCORE_POLICY_VERSION = "PAPER_ALPHASCORE_V1";
const D = Prisma.Decimal;
const zero = new D(0);
const hundred = new D(100);

export type AlphaScoreInput = { startingCash: string; currentValue: string; values: string[]; positionValues: string[]; completedChallenges: number };
export type AlphaScore = { total: string; performance: string; drawdown: string; diversification: string; consistency: string; challenge: string; coverage: string; assumptions: string[] };
const clamp = (value: Prisma.Decimal) => D.max(zero, D.min(hundred, value));

export function calculateAlphaScore(input: AlphaScoreInput): AlphaScore {
  const starting = new D(input.startingCash);
  const current = new D(input.currentValue);
  const performanceReturn = starting.gt(0) ? current.minus(starting).div(starting) : zero;
  // -20% maps to 0 and +20% maps to 100; extremes are capped.
  const performance = clamp(performanceReturn.plus(0.2).div(0.4).mul(100));
  const values = input.values.map((value) => new D(value));
  let peak = values[0] ?? current, maxDrawdown = zero;
  for (const value of values) { if (value.gt(peak)) peak = value; if (peak.gt(0)) maxDrawdown = D.max(maxDrawdown, peak.minus(value).div(peak)); }
  const drawdown = clamp(hundred.minus(maxDrawdown.mul(250)));
  const totalPositionValue = input.positionValues.reduce((sum, value) => sum.plus(value), zero);
  const largestWeight = totalPositionValue.gt(0) ? input.positionValues.map((value) => new D(value).div(totalPositionValue)).reduce((max, value) => D.max(max, value), zero) : zero;
  const holdingScore = clamp(new D(input.positionValues.length).div(5).mul(100));
  const diversification = clamp(holdingScore.mul(0.45).plus(hundred.minus(largestWeight.mul(100)).mul(0.55)));
  const returns = values.slice(1).map((value, index) => values[index].gt(0) ? value.minus(values[index]).div(values[index]) : zero);
  const positivePeriods = returns.length ? new D(returns.filter((value) => value.gte(0)).length).div(returns.length).mul(100) : new D(50);
  const consistency = clamp(positivePeriods);
  const challenge = clamp(new D(input.completedChallenges).mul(20));
  const total = clamp(performance.mul(0.4).plus(drawdown.mul(0.2)).plus(diversification.mul(0.15)).plus(consistency.mul(0.15)).plus(challenge.mul(0.1)));
  const coverage = values.length >= 2 ? hundred : new D(50);
  return { total: total.toFixed(4), performance: performance.toFixed(4), drawdown: drawdown.toFixed(4), diversification: diversification.toFixed(4), consistency: consistency.toFixed(4), challenge: challenge.toFixed(4), coverage: coverage.toFixed(4), assumptions: ["Simulated data only", "Performance contribution is capped at a +/-20% simulated return range", "No real-world investing ability is implied"] };
}
