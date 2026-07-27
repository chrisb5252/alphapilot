import { describe, expect, it } from "vitest";
import { buildDashboard } from "@/lib/portfolio/dashboard";
describe("dashboard calculations", () => {
  it("uses normalized database holding values", () => {
    const result = buildDashboard(
      [
        {
          id: "1",
          quantity: 2 as never,
          costBasis: 200 as never,
          currentPrice: 150 as never,
          marketValue: 300 as never,
          security: {
            canonicalSymbol: "AAPL",
            name: "Apple",
            sector: "Technology",
          },
        },
      ] as never,
      "Test",
      "import",
      new Date(),
    );
    expect(result.portfolio.totalValue).toBe(300);
    expect(result.allocation[0]).toMatchObject({
      label: "Technology",
      percentage: 100,
    });
  });
});
