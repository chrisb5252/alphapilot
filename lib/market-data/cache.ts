const ttlMs =
  Number(process.env.MARKET_DATA_CACHE_TTL_MINUTES ?? "15") * 60_000;

export function isMarketDataStale(retrievedAt: Date, now = Date.now()) {
  return now - retrievedAt.valueOf() > ttlMs;
}
