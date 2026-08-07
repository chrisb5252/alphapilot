import { describe, expect, it } from "vitest";
import { calculateAlphaScore, ALPHA_SCORE_POLICY_VERSION } from "@/lib/paper-game/alpha-score";
import { levelForXP, levelProgress } from "@/lib/paper-game/levels";

describe("paper-game progression", () => {
  it("uses centralized, deterministic XP thresholds", () => {
    expect(levelForXP(0)).toBe(1);
    expect(levelForXP(250)).toBe(2);
    expect(levelForXP(7_000)).toBe(10);
    expect(levelProgress(600)).toMatchObject({ currentLevel: 3, nextLevelXP: 1000 });
  });
});

describe("AlphaScore policy", () => {
  const balanced = { startingCash: "100000", currentValue: "105000", values: ["100000", "102000", "105000"], positionValues: ["21000", "21000", "21000", "21000", "21000"], completedChallenges: 2 };
  it("is deterministic and bounded", () => {
    const first = calculateAlphaScore(balanced);
    expect(calculateAlphaScore(balanced)).toEqual(first);
    expect(Number(first.total)).toBeGreaterThanOrEqual(0);
    expect(Number(first.total)).toBeLessThanOrEqual(100);
    expect(ALPHA_SCORE_POLICY_VERSION).toBe("PAPER_ALPHASCORE_V1");
  });
  it("caps an extreme speculative return rather than allowing it to dominate", () => {
    const score = calculateAlphaScore({ ...balanced, currentValue: "1000000", values: ["100000", "1000000"], positionValues: ["1000000"], completedChallenges: 0 });
    expect(Number(score.performance)).toBe(100);
    expect(Number(score.total)).toBeLessThan(100);
  });
});
