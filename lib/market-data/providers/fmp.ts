import { MarketDataRateLimitError } from "@/lib/market-data/errors";
import type {
  CompanyProfile,
  CompleteMarketDataProvider,
  CorporateEvent,
  Fundamentals,
  HistoricalPricePoint,
  NewsItem,
  ProviderResult,
  Quote,
  SecurityCandidate,
  SecurityLookup,
} from "@/lib/market-data/types";

const baseUrl = "https://financialmodelingprep.com/stable/";
type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : undefined;
}
function decimal(value: unknown): string | undefined {
  const candidate = text(value);
  return candidate && /^-?\d+(\.\d+)?$/.test(candidate) ? candidate : undefined;
}
function date(value: unknown): Date | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  const parsed = new Date(
    candidate.includes("T") ? candidate : `${candidate}T00:00:00Z`,
  );
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
}

export class FmpProvider implements CompleteMarketDataProvider {
  readonly id = "FMP" as const;
  constructor(private readonly apiKey: string) {}

  private async query(
    path: string,
    parameters: Record<string, string> = {},
  ): Promise<unknown> {
    const url = new URL(path, baseUrl);
    url.searchParams.set("apikey", this.apiKey);
    for (const [key, value] of Object.entries(parameters))
      url.searchParams.set(key, value);
    const response = await fetch(url, { next: { revalidate: 0 } });
    if (response.status === 429)
      throw new MarketDataRateLimitError("FMP rate limit reached.");
    // FMP can return a plain-text plan-access message with an HTTP 200 status.
    // Parse text first so that message is preserved rather than surfacing a
    // misleading JSON parse error to an investor.
    const responseText = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(responseText);
    } catch {
      const message = responseText.trim().slice(0, 240);
      throw new Error(
        message
          ? `FMP plan or provider response: ${message}`
          : `FMP returned HTTP ${response.status} without a response body.`,
      );
    }
    if (!response.ok)
      throw new Error(
        `FMP returned HTTP ${response.status}: ${text(object(body).message) ?? text(object(body).error) ?? "request failed"}`,
      );
    const error =
      text(object(body).Error) ??
      text(object(body)["Error Message"]) ??
      text(object(body).message);
    if (
      error &&
      /invalid|limit|rate|subscription|premium|forbidden/i.test(error)
    ) {
      if (/limit|rate/i.test(error))
        throw new MarketDataRateLimitError(error, 60_000);
      throw new Error(error);
    }
    return body;
  }
  private symbol(lookup: SecurityLookup) {
    return lookup.symbol?.trim().toUpperCase();
  }
  private failure(error: unknown): ProviderResult<never> {
    if (error instanceof MarketDataRateLimitError)
      return {
        ok: false,
        status: "PROVIDER_FAILURE",
        code: error.code,
        message: error.message,
        retryAfterMs: error.retryAfterMs,
      };
    return {
      ok: false,
      status: "PROVIDER_FAILURE",
      code: "PROVIDER_ERROR",
      message: error instanceof Error ? error.message : "FMP failed.",
    };
  }

  async resolveSecurity(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<SecurityCandidate[]>> {
    const query = lookup.symbol ?? lookup.name;
    if (!query)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "IDENTIFIER_REQUIRED",
        message: "A ticker or security name is required for FMP search.",
      };
    try {
      const body = list(await this.query("search-symbol", { query }));
      return {
        ok: true,
        value: body.slice(0, 10).map((item) => {
          const row = object(item);
          const symbol = text(row.symbol);
          return {
            symbol,
            providerSecurityId: text(row.symbol),
            name: text(row.name) ?? symbol ?? "Unnamed security",
            exchange: text(row.exchangeShortName) ?? text(row.stockExchange),
            currency: text(row.currency),
            securityType: text(row.type),
            confidence:
              symbol?.toUpperCase() === lookup.symbol?.toUpperCase() ? 1 : 0.8,
            evidence: { endpoint: "search-symbol", query, raw: row },
          };
        }),
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getQuote(lookup: SecurityLookup): Promise<ProviderResult<Quote>> {
    const symbol = this.symbol(lookup);
    if (!symbol)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "SYMBOL_REQUIRED",
        message: "FMP quotes require a resolved ticker.",
      };
    try {
      const row = object(list(await this.query("quote", { symbol }))[0]);
      const price = decimal(row.price);
      if (!price)
        return {
          ok: false,
          status: "UNAVAILABLE",
          code: "NO_QUOTE",
          message: "FMP did not return a quote for this security.",
        };
      const timestamp = date(row.timestamp) ?? date(row.lastUpdated);
      return {
        ok: true,
        value: {
          price,
          currency: text(row.currency),
          previousClose: decimal(row.previousClose),
          change: decimal(row.change),
          changePercent:
            decimal(row.changesPercentage) ?? decimal(row.changePercentage),
          marketTimestamp: timestamp,
          providerTimestamp: new Date(),
          dataStatus: "DELAYED",
          provenance: { endpoint: "quote", symbol, raw: row },
        },
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getHistoricalPrices(
    lookup: SecurityLookup,
    options: { adjusted?: boolean; outputSize?: "compact" | "full" } = {},
  ): Promise<ProviderResult<HistoricalPricePoint[]>> {
    const symbol = this.symbol(lookup);
    if (!symbol)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "SYMBOL_REQUIRED",
        message: "FMP history requires a resolved ticker.",
      };
    const path =
      options.adjusted === false
        ? "historical-price-eod/non-split-adjusted"
        : "historical-price-eod/full";
    try {
      const body = await this.query(path, { symbol });
      const rows = list(body).length
        ? list(body)
        : list(object(body).historical);
      const points = rows.flatMap((item) => {
        const row = object(item);
        const tradingDate = date(row.date);
        if (!tradingDate) return [];
        return [
          {
            tradingDate,
            open: decimal(row.open),
            high: decimal(row.high),
            low: decimal(row.low),
            close: decimal(row.close),
            adjustedClose: decimal(row.adjClose) ?? decimal(row.adjustedClose),
            volume: decimal(row.volume),
            currency: text(row.currency),
            isAdjusted: options.adjusted !== false,
            marketTimestamp: tradingDate,
            providerTimestamp: new Date(),
            provenance: { endpoint: path, symbol, raw: row },
          },
        ];
      });
      // FMP's `full` endpoint returns every available trading day. Persisting
      // decades of daily bars during a button-click refresh can exceed a
      // serverless request's time and database-parameter limits (AAPL is a
      // particularly large example). A compact request deliberately keeps the
      // most recent ~one trading year; a scheduled backfill can request more.
      const boundedPoints =
        options.outputSize === "compact" ? points.slice(0, 260) : points;
      return boundedPoints.length
        ? { ok: true, value: boundedPoints }
        : {
            ok: false,
            status: "UNAVAILABLE",
            code: "NO_HISTORY",
            message: "FMP did not return price history for this security.",
          };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getCompanyProfile(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<CompanyProfile>> {
    const symbol = this.symbol(lookup);
    if (!symbol)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "SYMBOL_REQUIRED",
        message: "FMP profiles require a resolved ticker.",
      };
    try {
      const row = object(list(await this.query("profile", { symbol }))[0]);
      if (!Object.keys(row).length)
        return {
          ok: false,
          status: "UNAVAILABLE",
          code: "NO_PROFILE",
          message: "FMP did not return a profile for this security.",
        };
      return {
        ok: true,
        value: {
          name: text(row.companyName) ?? text(row.name),
          assetClass: text(row.type),
          sector: text(row.sector),
          industry: text(row.industry),
          country: text(row.country),
          exchange: text(row.exchangeShortName) ?? text(row.exchange),
          marketCap: decimal(row.marketCap),
          dividendYield: decimal(row.lastDiv) ?? decimal(row.dividendYield),
          beta: decimal(row.beta),
          profile: row,
          providerTimestamp: new Date(),
        },
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getFundamentals(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<Fundamentals>> {
    const symbol = this.symbol(lookup);
    if (!symbol)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "SYMBOL_REQUIRED",
        message: "FMP fundamentals require a resolved ticker.",
      };
    try {
      const [incomeStatements, balanceSheets, cashFlows, metrics] =
        await Promise.all([
          this.query("income-statement", { symbol }),
          this.query("balance-sheet-statement", { symbol }),
          this.query("cash-flow-statement", { symbol }),
          this.query("key-metrics-ttm", { symbol }),
        ]);
      return {
        ok: true,
        value: {
          incomeStatements,
          balanceSheets,
          cashFlows,
          valuationMetrics: object(list(metrics)[0]),
          providerTimestamp: new Date(),
        },
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getCorporateEvents(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<CorporateEvent[]>> {
    const symbol = this.symbol(lookup);
    if (!symbol)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "SYMBOL_REQUIRED",
        message: "FMP corporate events require a resolved ticker.",
      };
    try {
      const [dividends, splits] = await Promise.all([
        this.query("dividends", { symbol }),
        this.query("splits", { symbol }),
      ]);
      const events: CorporateEvent[] = [];
      for (const item of list(dividends)) {
        const row = object(item);
        const eventDate =
          date(row.paymentDate) ?? date(row.recordDate) ?? date(row.date);
        if (eventDate)
          events.push({
            providerEventId: text(row.date) ?? eventDate.toISOString(),
            type: "DIVIDEND",
            eventDate,
            announcedAt: date(row.declarationDate),
            amount: decimal(row.dividend) ?? decimal(row.adjDividend),
            currency: text(row.currency),
            metadata: row,
            providerTimestamp: new Date(),
          });
      }
      for (const item of list(splits)) {
        const row = object(item);
        const eventDate = date(row.date);
        if (eventDate)
          events.push({
            providerEventId: text(row.date) ?? eventDate.toISOString(),
            type: "SPLIT",
            eventDate,
            amount: decimal(row.numerator) ?? decimal(row.splitRatio),
            metadata: row,
            providerTimestamp: new Date(),
          });
      }
      return { ok: true, value: events };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getEarningsCalendar(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<CorporateEvent[]>> {
    const symbol = this.symbol(lookup);
    if (!symbol)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "SYMBOL_REQUIRED",
        message: "FMP earnings require a resolved ticker.",
      };
    try {
      const rows = list(await this.query("earnings", { symbol }));
      return {
        ok: true,
        value: rows.flatMap((item) => {
          const row = object(item);
          const eventDate = date(row.date);
          return eventDate
            ? [
                {
                  providerEventId: text(row.date) ?? eventDate.toISOString(),
                  type: "EARNINGS" as const,
                  eventDate,
                  announcedAt: eventDate,
                  metadata: row,
                  providerTimestamp: new Date(),
                },
              ]
            : [];
        }),
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getRelevantNews(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<NewsItem[]>> {
    const symbol = this.symbol(lookup);
    if (!symbol)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "SYMBOL_REQUIRED",
        message: "FMP news requires a resolved ticker.",
      };
    try {
      const rows = list(await this.query("news/stock", { symbols: symbol }));
      return {
        ok: true,
        value: rows.slice(0, 25).flatMap((item) => {
          const row = object(item);
          const headline = text(row.title);
          const id = text(row.url) ?? text(row.publishedDate);
          return headline && id
            ? [
                {
                  providerArticleId: id,
                  sourceName: text(row.site) ?? text(row.publisher),
                  sourceUrl: text(row.url),
                  headline,
                  summary: text(row.text),
                  publishedAt: date(row.publishedDate),
                  providerTimestamp: new Date(),
                  metadata: row,
                },
              ]
            : [];
        }),
      };
    } catch (error) {
      return this.failure(error);
    }
  }
}
