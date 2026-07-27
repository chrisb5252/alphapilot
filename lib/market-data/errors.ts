export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

export class MarketDataRateLimitError extends MarketDataError {
  constructor(
    message = "Market-data provider rate limit reached.",
    retryAfterMs = 60_000,
  ) {
    super(message, "RATE_LIMITED", retryAfterMs);
  }
}

export class MarketDataPermanentError extends MarketDataError {}
