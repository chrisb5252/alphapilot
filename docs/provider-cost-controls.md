# Provider cost controls

## Defaults

- Market data is disabled until a server-only FMP API key is configured.
- `MARKET_DATA_DAILY_REQUEST_LIMIT` defaults to `25` per UTC day.
- Quote cache TTL defaults to 15 minutes.
- Identical in-process quote refreshes share one promise.
- Import jobs are deduplicated while an equivalent job is pending or running.
- The daily worker processes only four market-data jobs per invocation.

## Rate limits and failures

Provider responses that indicate rate limiting are persisted in `MarketDataUsage`, never retried immediately, and requeued using the provider retry window or exponential backoff. Non-rate failures retry at most five times. Unsupported or unresolved assets do not trigger vendor calls until an explicit resolution retry job runs.

## Operational guidance

Set a provider plan-specific limit below the contractual allowance; do not rely on a provider's free-tier number being stable. Monitor `MarketDataUsage` daily and alert before the configured budget is exhausted. Keep API keys server-only, rotate them through the vendor dashboard, and use a separate key/environment for development.

Do not expose an unauthenticated quote proxy. The market-data read route verifies that the requested security belongs to the authenticated user's holding or watchlist.
