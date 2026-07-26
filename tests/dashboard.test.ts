import { describe, expect, it } from "vitest";
import { buildDashboard } from "@/lib/portfolio/dashboard";
describe("dashboard calculations", () => { it("uses imported holding values", () => { const result = buildDashboard([{ id:"1", symbol:"AAPL", companyName:"Apple", sector:"Technology", shares:2 as never, costBasis:100 as never, currentPrice:150 as never, marketValue:300 as never }] as never, "Test", "import", new Date()); expect(result.portfolio.totalValue).toBe(300); expect(result.allocation[0]).toMatchObject({label:"Technology",percentage:100}); }); });
