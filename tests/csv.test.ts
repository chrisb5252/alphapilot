import { describe, expect, it } from "vitest";
import { parsePortfolioCsv } from "@/lib/import/csv";
describe("portfolio CSV parsing", () => {
  it("normalizes common broker headers", () => { const result = parsePortfolioCsv("Ticker,Company,Shares,Average Cost,Market Value\nAAPL,Apple Inc,2,100,400"); expect(result.rows[0]).toMatchObject({ symbol: "AAPL", companyName: "Apple Inc", shares: 2, marketValue: 400 }); });
  it("flags bad and duplicate rows with source row numbers", () => { const result = parsePortfolioCsv("Symbol,Quantity\nAAPL,1\nAAPL,-2"); expect(result.rows[1].errors.map(x=>x.message).join(" ")).toContain("Duplicate"); expect(result.rows[1].rowNumber).toBe(3); });
  it("rejects an empty file", () => expect(parsePortfolioCsv(" ").fileErrors[0]).toContain("empty"));
});
