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

const endpoint = "https://www.alphavantage.co/query";
type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function decimal(value: unknown): string | undefined {
  const candidate = text(value);
  return candidate && /^-?\d+(\.\d+)?$/.test(candidate) ? candidate : undefined;
}
function date(value: unknown): Date | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  const result = new Date(
    candidate.includes("T") ? candidate : `${candidate}T00:00:00Z`,
  );
  return Number.isNaN(result.valueOf()) ? undefined : result;
}

export class AlphaVantageProvider implements CompleteMarketDataProvider {
  readonly id = "ALPHA_VANTAGE" as const;
  constructor(private readonly apiKey: string) {}

  private async query(
    functionName: string,
    parameters: Record<string, string> = {},
  ) {
    const url = new URL(endpoint);
    url.searchParams.set("function", functionName);
    url.searchParams.set("apikey", this.apiKey);
    for (const [key, value] of Object.entries(parameters))
      url.searchParams.set(key, value);
    const response = await fetch(url, { next: { revalidate: 0 } });
    if (response.status === 429)
      throw new MarketDataRateLimitError("Alpha Vantage rate limit reached.");
    if (!response.ok)
      throw new MarketDataErrorResponse(
        `Alpha Vantage returned HTTP ${response.status}.`,
      );
    const body = asObject(await response.json());
    const providerMessage =
      text(body.Note) ?? text(body.Information) ?? text(body["Error Message"]);
    if (providerMessage) {
      if (/rate|call frequency|premium/i.test(providerMessage))
        throw new MarketDataRateLimitError(providerMessage, 60_000);
      throw new MarketDataErrorResponse(providerMessage);
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
      code: error instanceof Error ? "PROVIDER_ERROR" : "UNKNOWN_ERROR",
      message:
        error instanceof Error ? error.message : "Market-data provider failed.",
    };
  }

  async resolveSecurity(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<SecurityCandidate[]>> {
    const keywords = lookup.symbol ?? lookup.name;
    if (!keywords)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "IDENTIFIER_REQUIRED",
        message: "A ticker or security name is required for this provider.",
      };
    if (lookup.cusip || lookup.isin)
      return {
        ok: false,
        status: "UNSUPPORTED",
        code: "IDENTIFIER_UNSUPPORTED",
        message:
          "Alpha Vantage cannot safely resolve this CUSIP or ISIN without a symbol.",
      };
    try {
      const body = await this.query("SYMBOL_SEARCH", { keywords });
      const matches = Array.isArray(body.bestMatches) ? body.bestMatches : [];
      return {
        ok: true,
        value: matches.slice(0, 10).map((item) => {
          const row = asObject(item);
          const symbol = text(row["1. symbol"]);
          const name = text(row["2. name"]) ?? symbol ?? "Unnamed security";
          const score = Number(text(row["9. matchScore"]) ?? "0");
          return {
            symbol,
            name,
            exchange: text(row["4. region"]),
            currency: text(row["8. currency"]),
            securityType: text(row["3. type"]),
            confidence: Number.isFinite(score) ? score : 0,
            evidence: {
              query: keywords,
              providerMatchScore: text(row["9. matchScore"]),
              raw: row,
            },
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
        message: "Quotes require a resolved ticker for this provider.",
      };
    try {
      const body = await this.query("GLOBAL_QUOTE", { symbol });
      const quote = asObject(body["Global Quote"]);
      const price = decimal(quote["05. price"]);
      if (!price)
        return {
          ok: false,
          status: "UNAVAILABLE",
          code: "NO_QUOTE",
          message: "No quote is available for this security.",
        };
      const marketDate = date(quote["07. latest trading day"]);
      return {
        ok: true,
        value: {
          price,
          previousClose: decimal(quote["08. previous close"]),
          change: decimal(quote["09. change"]),
          changePercent: decimal(
            text(quote["10. change percent"])?.replace("%", ""),
          ),
          marketTimestamp: marketDate,
          providerTimestamp: new Date(),
          dataStatus: "DELAYED",
          provenance: { endpoint: "GLOBAL_QUOTE", symbol, raw: quote },
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
        message:
          "Historical prices require a resolved ticker for this provider.",
      };
    const adjusted = options.adjusted !== false;
    try {
      const body = await this.query(
        adjusted ? "TIME_SERIES_DAILY_ADJUSTED" : "TIME_SERIES_DAILY",
        { symbol, outputsize: options.outputSize ?? "compact" },
      );
      const series = asObject(
        body[adjusted ? "Time Series (Daily)" : "Time Series (Daily)"],
      );
      const points = Object.entries(series).flatMap(([day, raw]) => {
        const row = asObject(raw);
        const tradingDate = date(day);
        if (!tradingDate) return [];
        return [
          {
            tradingDate,
            open: decimal(row["1. open"]),
            high: decimal(row["2. high"]),
            low: decimal(row["3. low"]),
            close: decimal(row["4. close"]),
            adjustedClose: adjusted
              ? decimal(row["5. adjusted close"])
              : undefined,
            volume: decimal(adjusted ? row["6. volume"] : row["5. volume"]),
            isAdjusted: adjusted,
            marketTimestamp: tradingDate,
            providerTimestamp: new Date(),
            provenance: {
              endpoint: adjusted
                ? "TIME_SERIES_DAILY_ADJUSTED"
                : "TIME_SERIES_DAILY",
              symbol,
              raw: row,
            },
          },
        ];
      });
      return points.length
        ? { ok: true, value: points }
        : {
            ok: false,
            status: "UNAVAILABLE",
            code: "NO_HISTORY",
            message: "No historical prices are available for this security.",
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
        message:
          "Company profiles require a resolved ticker for this provider.",
      };
    try {
      const body = await this.query("OVERVIEW", { symbol });
      if (!Object.keys(body).length)
        return {
          ok: false,
          status: "UNAVAILABLE",
          code: "NO_PROFILE",
          message: "No company profile is available for this security.",
        };
      return {
        ok: true,
        value: {
          name: text(body.Name),
          assetClass: text(body.AssetType),
          sector: text(body.Sector),
          industry: text(body.Industry),
          country: text(body.Country),
          exchange: text(body.Exchange),
          marketCap: decimal(body.MarketCapitalization),
          dividendYield: decimal(body.DividendYield),
          beta: decimal(body.Beta),
          profile: body,
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
        message: "Fundamentals require a resolved ticker for this provider.",
      };
    try {
      const [income, balance, cash, overview] = await Promise.all([
        this.query("INCOME_STATEMENT", { symbol }),
        this.query("BALANCE_SHEET", { symbol }),
        this.query("CASH_FLOW", { symbol }),
        this.query("OVERVIEW", { symbol }),
      ]);
      return {
        ok: true,
        value: {
          incomeStatements: income,
          balanceSheets: balance,
          cashFlows: cash,
          valuationMetrics: {
            peRatio: text(overview.PERatio),
            pegRatio: text(overview.PEGRatio),
            priceToBook: text(overview.PriceToBookRatio),
            evToRevenue: text(overview.EVToRevenue),
            evToEbitda: text(overview.EVToEBITDA),
          },
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
    const history = await this.getHistoricalPrices(lookup, {
      adjusted: true,
      outputSize: "compact",
    });
    if (!history.ok) return history;
    const events: CorporateEvent[] = [];
    for (const point of history.value) {
      const raw = asObject(point.provenance.raw);
      const dividend = decimal(raw["7. dividend amount"]);
      const split = decimal(raw["8. split coefficient"]);
      if (dividend && dividend !== "0")
        events.push({
          type: "DIVIDEND",
          eventDate: point.tradingDate,
          amount: dividend,
          marketTimestamp: point.marketTimestamp,
          providerTimestamp: point.providerTimestamp,
          metadata: { endpoint: "TIME_SERIES_DAILY_ADJUSTED" },
        });
      if (split && split !== "1")
        events.push({
          type: "SPLIT",
          eventDate: point.tradingDate,
          amount: split,
          marketTimestamp: point.marketTimestamp,
          providerTimestamp: point.providerTimestamp,
          metadata: {
            endpoint: "TIME_SERIES_DAILY_ADJUSTED",
            coefficient: split,
          },
        });
    }
    return { ok: true, value: events };
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
        message: "Earnings data requires a resolved ticker for this provider.",
      };
    try {
      const body = await this.query("EARNINGS", { symbol });
      const quarterly = Array.isArray(body.quarterlyEarnings)
        ? body.quarterlyEarnings
        : [];
      return {
        ok: true,
        value: quarterly.flatMap((item) => {
          const row = asObject(item);
          const eventDate = date(row.reportedDate);
          return eventDate
            ? [
                {
                  providerEventId: `${symbol}-${text(row.fiscalDateEnding) ?? eventDate.toISOString()}`,
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
        message: "News requires a resolved ticker for this provider.",
      };
    try {
      const body = await this.query("NEWS_SENTIMENT", {
        tickers: symbol,
        limit: "25",
      });
      const feed = Array.isArray(body.feed) ? body.feed : [];
      return {
        ok: true,
        value: feed.flatMap((item) => {
          const row = asObject(item);
          const headline = text(row.title);
          const id = text(row.url) ?? text(row.time_published);
          return headline && id
            ? [
                {
                  providerArticleId: id,
                  sourceName: text(row.source),
                  sourceUrl: text(row.url),
                  headline,
                  summary: text(row.summary),
                  publishedAt: date(row.time_published),
                  providerTimestamp: new Date(),
                  metadata: {
                    overallSentimentLabel: text(row.overall_sentiment_label),
                  },
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

class MarketDataErrorResponse extends Error {}
