import { afterEach, describe, expect, it, vi } from "vitest";
import { AlphaVantageProvider } from "@/lib/market-data/providers/alpha-vantage";
import { FmpProvider } from "@/lib/market-data/providers/fmp";
import { chooseResolutionCandidate } from "@/lib/market-data/resolution";
import { isMarketDataStale } from "@/lib/market-data/cache";

const provider = new AlphaVantageProvider("test-key");
const fmp = new FmpProvider("test-key");

afterEach(() => vi.restoreAllMocks());

describe("market-data security resolution", () => {
  it("resolves one exact ticker deterministically", () => {
    expect(
      chooseResolutionCandidate({ symbol: "AAPL" }, [
        { symbol: "AAPL", name: "Apple Inc.", confidence: 0.99, evidence: {} },
      ]),
    ).toMatchObject({ status: "RESOLVED", candidate: { symbol: "AAPL" } });
  });

  it("does not silently resolve an ambiguous ticker", () => {
    expect(
      chooseResolutionCandidate({ symbol: "ABC" }, [
        { symbol: "ABC", name: "ABC Holdings", confidence: 0.99, evidence: {} },
        {
          symbol: "ABC",
          name: "ABC International",
          confidence: 0.99,
          evidence: {},
        },
      ]).status,
    ).toBe("AMBIGUOUS");
  });

  it("keeps an international exchange-qualified ticker intact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          bestMatches: [
            {
              "1. symbol": "VOD.L",
              "2. name": "Vodafone Group Plc",
              "4. region": "United Kingdom",
              "8. currency": "GBP",
              "9. matchScore": "1.0000",
            },
          ],
        }),
      }),
    );
    const result = await provider.resolveSecurity({ symbol: "VOD.L" });
    expect(result).toMatchObject({
      ok: true,
      value: [{ symbol: "VOD.L", currency: "GBP" }],
    });
  });
});

describe("Alpha Vantage normalization", () => {
  it("normalizes a delayed quote without inventing a currency", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          "Global Quote": {
            "05. price": "187.1200",
            "08. previous close": "185.0000",
            "09. change": "2.1200",
            "10. change percent": "1.1459%",
            "07. latest trading day": "2026-07-27",
          },
        }),
      }),
    );
    const result = await provider.getQuote({ symbol: "AAPL" });
    expect(result).toMatchObject({
      ok: true,
      value: {
        price: "187.1200",
        changePercent: "1.1459",
        dataStatus: "DELAYED",
      },
    });
  });

  it("marks adjusted historical prices explicitly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          "Time Series (Daily)": {
            "2026-07-27": {
              "1. open": "10",
              "2. high": "11",
              "3. low": "9",
              "4. close": "10.5",
              "5. adjusted close": "10.25",
              "6. volume": "1000",
              "7. dividend amount": "0",
              "8. split coefficient": "1",
            },
          },
        }),
      }),
    );
    const result = await provider.getHistoricalPrices({ symbol: "AAPL" });
    expect(result).toMatchObject({
      ok: true,
      value: [{ isAdjusted: true, adjustedClose: "10.25" }],
    });
  });

  it("surfaces provider rate limits instead of retrying blindly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          Note: "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute.",
        }),
      }),
    );
    const result = await provider.getQuote({ symbol: "AAPL" });
    expect(result).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      status: "PROVIDER_FAILURE",
    });
  });

  it("labels cache entries as stale only after their configured TTL", () => {
    const now = Date.now();
    expect(isMarketDataStale(new Date(now - 1_000), now)).toBe(false);
    expect(isMarketDataStale(new Date(now - 16 * 60_000), now)).toBe(true);
  });
});

describe("FMP normalization", () => {
  it("normalizes an FMP quote through the same provider-neutral contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            symbol: "AAPL",
            price: 201.25,
            previousClose: 200,
            change: 1.25,
            changesPercentage: 0.625,
            currency: "USD",
          },
        ],
      }),
    );
    const result = await fmp.getQuote({ symbol: "AAPL" });
    expect(result).toMatchObject({
      ok: true,
      value: {
        price: "201.25",
        previousClose: "200",
        dataStatus: "DELAYED",
      },
    });
  });
});
