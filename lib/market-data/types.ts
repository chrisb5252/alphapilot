export type MarketDataProviderId = "ALPHA_VANTAGE" | "FMP";

export type MarketDataStatus =
  | "REAL_TIME"
  | "DELAYED"
  | "END_OF_DAY"
  | "STALE"
  | "UNAVAILABLE"
  | "UNSUPPORTED"
  | "PROVIDER_FAILURE";

export type SecurityResolutionStatus =
  "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED" | "UNSUPPORTED";

export type SecurityLookup = {
  securityId?: string;
  providerSecurityId?: string | null;
  symbol?: string | null;
  exchange?: string | null;
  cusip?: string | null;
  isin?: string | null;
  name?: string | null;
  securityType?: string | null;
  currency?: string | null;
};

export type SecurityCandidate = {
  providerSecurityId?: string;
  symbol?: string;
  name: string;
  exchange?: string;
  country?: string;
  currency?: string;
  securityType?: string;
  confidence: number;
  evidence: Record<string, unknown>;
};

export type ResolutionResult = {
  status: SecurityResolutionStatus;
  source: string;
  candidate?: SecurityCandidate;
  candidates?: SecurityCandidate[];
  message?: string;
};

export type Quote = {
  price?: string;
  currency?: string;
  previousClose?: string;
  change?: string;
  changePercent?: string;
  marketTimestamp?: Date;
  providerTimestamp?: Date;
  dataStatus: MarketDataStatus;
  provenance: Record<string, unknown>;
};

export type HistoricalPricePoint = {
  tradingDate: Date;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  adjustedClose?: string;
  volume?: string;
  currency?: string;
  isAdjusted: boolean;
  marketTimestamp?: Date;
  providerTimestamp?: Date;
  provenance: Record<string, unknown>;
};

export type CompanyProfile = {
  name?: string;
  assetClass?: string;
  sector?: string;
  industry?: string;
  country?: string;
  exchange?: string;
  marketCap?: string;
  fundCategory?: string;
  expenseRatio?: string;
  dividendYield?: string;
  beta?: string;
  profile: Record<string, unknown>;
  providerTimestamp?: Date;
};

export type Fundamentals = {
  incomeStatements?: unknown;
  balanceSheets?: unknown;
  cashFlows?: unknown;
  valuationMetrics?: Record<string, unknown>;
  providerTimestamp?: Date;
};

export type CorporateEvent = {
  providerEventId?: string;
  type: "DIVIDEND" | "EARNINGS" | "SPLIT";
  eventDate: Date;
  announcedAt?: Date;
  amount?: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  marketTimestamp?: Date;
  providerTimestamp?: Date;
};

export type NewsItem = {
  providerArticleId: string;
  sourceName?: string;
  sourceUrl?: string;
  headline: string;
  summary?: string;
  publishedAt?: Date;
  providerTimestamp?: Date;
  metadata?: Record<string, unknown>;
};

export type ProviderResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      status: Extract<
        MarketDataStatus,
        "UNAVAILABLE" | "UNSUPPORTED" | "PROVIDER_FAILURE"
      >;
      code: string;
      message: string;
      retryAfterMs?: number;
    };

export interface SecurityReferenceProvider {
  resolveSecurity(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<SecurityCandidate[]>>;
}

export interface MarketDataProvider {
  readonly id: MarketDataProviderId;
  getQuote(lookup: SecurityLookup): Promise<ProviderResult<Quote>>;
  getHistoricalPrices(
    lookup: SecurityLookup,
    options?: { adjusted?: boolean; outputSize?: "compact" | "full" },
  ): Promise<ProviderResult<HistoricalPricePoint[]>>;
}

export interface FundamentalsProvider {
  getCompanyProfile(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<CompanyProfile>>;
  getFundamentals(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<Fundamentals>>;
}

export interface CorporateEventsProvider {
  getCorporateEvents(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<CorporateEvent[]>>;
  getEarningsCalendar(
    lookup: SecurityLookup,
  ): Promise<ProviderResult<CorporateEvent[]>>;
}

export interface NewsProvider {
  getRelevantNews(lookup: SecurityLookup): Promise<ProviderResult<NewsItem[]>>;
}

export type CompleteMarketDataProvider = MarketDataProvider &
  SecurityReferenceProvider &
  FundamentalsProvider &
  CorporateEventsProvider &
  NewsProvider;
