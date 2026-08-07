/**
 * Central, server-only feature limits. Billing can replace the temporary
 * allow-list without callers needing to know about plan names or Stripe.
 */
export type AlphaPilotPlan = "FREE" | "PRO" | "PREMIUM";

export type Entitlements = {
  plan: AlphaPilotPlan;
  paperPortfolioLimit: number;
  paperLeagueCreationLimit: number;
};

export function getEntitlementsForUser(userId: string): Entitlements {
  const proUserIds = new Set(
    (process.env.PAPER_TRADING_PRO_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const plan: AlphaPilotPlan = proUserIds.has(userId) ? "PRO" : "FREE";
  return {
    plan,
    // Premium remains intentionally disabled until its product definition exists.
    paperPortfolioLimit: plan === "FREE" ? 2 : 10,
    paperLeagueCreationLimit: plan === "FREE" ? 1 : 10,
  };
}
