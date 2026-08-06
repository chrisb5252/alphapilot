import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const prismaMock = vi.hoisted(() => ({
  paperPortfolio: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  paperPosition: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/market-data/paper-quote", () => ({
  getPaperTradeQuote: vi.fn().mockResolvedValue({ ticker: "AAPL", price: "100" }),
  getCachedPaperQuote: vi.fn(),
}));

import {
  calculateAverageCost,
  calculateCash,
  createPaperPortfolio,
  getOwnedPaperPortfolio,
  PaperTradingError,
  assertTradePermitted,
  calculatePaperPortfolioValue,
} from "@/lib/paper-trading/service";

const d = (value: string | number) => new Prisma.Decimal(value);

describe("paper-trading ledger math", () => {
  it("deducts buys and adds sells without JavaScript floating-point arithmetic", () => {
    expect(calculateCash(d("1000"), [
      { type: "BUY", shares: d("3"), priceAtAction: d("99.95") },
      { type: "SELL", shares: d("1"), priceAtAction: d("101.10") },
    ]).toString()).toBe("801.25");
  });

  it("averages cost basis by dollars invested", () => {
    expect(calculateAverageCost(d("2"), d("100"), d("3"), d("110")).toString()).toBe("106");
  });

  it("rejects purchases that exceed simulated cash", () => {
    expect(() => assertTradePermitted({ cash: d("100"), heldShares: null, type: "BUY", shares: d("2"), price: d("75") })).toThrow("enough simulated cash");
  });

  it("rejects a simulated sale larger than the position", () => {
    expect(() => assertTradePermitted({ cash: d("100"), heldShares: d("1.5"), type: "SELL", shares: d("2"), price: d("75") })).toThrow("cannot sell more");
  });

  it("values a portfolio against deterministic mocked current prices", () => {
    // 2 shares at $120 plus 3 shares at $10, with $50 cash.
    expect(calculatePaperPortfolioValue(d("50"), [d("240"), d("30")])!.toString()).toBe("320");
    expect(calculatePaperPortfolioValue(d("50"), [d("240"), null])).toBeNull();
  });
});

describe("paper portfolio authorization and free cap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always scopes a requested portfolio by the authenticated app user", async () => {
    prismaMock.paperPortfolio.findFirst.mockResolvedValue(null);
    await expect(getOwnedPaperPortfolio("user-a", "portfolio-b")).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.paperPortfolio.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "portfolio-b", userId: "user-a" } }));
  });

  it("rejects a third free portfolio on the server", async () => {
    prismaMock.paperPortfolio.count.mockResolvedValue(2);
    await expect(createPaperPortfolio({ userId: "free-user" })).rejects.toBeInstanceOf(PaperTradingError);
    expect(prismaMock.paperPortfolio.create).not.toHaveBeenCalled();
  });
});
