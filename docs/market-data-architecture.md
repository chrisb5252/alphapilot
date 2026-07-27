# Market-data architecture

## Design

AlphaPilot uses provider-neutral TypeScript interfaces in `lib/market-data/types.ts`:

- `MarketDataProvider` — quotes and adjusted/unadjusted historical prices.
- `SecurityReferenceProvider` — conservative identity lookup.
- `FundamentalsProvider` — profile, financial statements, and valuation data.
- `CorporateEventsProvider` — dividends, earnings, and splits.
- `NewsProvider` — relevant news with source metadata.

The active primary adapter is `FmpProvider`, called through HTTP rather than a vendor SDK. `AlphaVantageProvider` remains available as an optional fallback. Without a configured provider, the app continues to use broker/import values and marks market data unavailable; it never substitutes zero or fabricated data.

FMP was selected after reviewing its official documentation for global exchanges, quotes, historical prices, ETFs/mutual funds, statements, dividends, splits, earnings, and news: <https://site.financialmodelingprep.com/developer/docs/stable>.

## Identity resolution

The canonical `Security` record remains provider-neutral. Resolution considers provider security ID, ticker, exchange, CUSIP, ISIN, and name. The first adapter can safely search ticker/name only. A result is persisted in `MarketSecurityResolution` with confidence, evidence, source, provider, and status.

Only a unique exact ticker/high-confidence result is auto-resolved. Ties, conflicting exchanges, CUSIP/ISIN unsupported by the adapter, and identifier-free records are saved as `AMBIGUOUS`, `UNRESOLVED`, or `UNSUPPORTED` rather than mapped silently.

## Persistence and provenance

`MarketQuote`, `HistoricalPrice`, `SecurityEnrichment`, `CorporateEvent`, and `MarketNewsItem` retain provider, retrieval time, provider timestamp, market timestamp where available, and normalization method. Historical prices record whether they are split/dividend adjusted. `MarketDataUsage` records provider request, failure, and rate-limit counts per UTC day.

The dashboard reads quote status only as a data-quality label; it does not overwrite a holding's imported value with a quote. This avoids creating an implied FX conversion or intraday valuation without explicit policy.

## Jobs

Imports enqueue five bounded jobs per unique security: identity retry, enrichment, quote refresh, adjusted-history backfill, and corporate-event refresh. The existing authenticated daily worker processes at most four market-data jobs after brokerage-sync work. Jobs use exponential backoff, have a five-attempt cap for transient failures, and defer rate-limited work until the provider's suggested retry window.

For Vercel Hobby, the configured daily cron is intentionally conservative. Move job processing to a durable queue/worker before promising intraday refreshes or processing large portfolios.

## Provider support boundaries

The first adapter supports globally-searchable listed equities and the vendor's available ETF/fund data. It does not infer data for cash, unsupported fixed income, options, non-listed securities, or identifier-only records. Those records remain visible with an explicit unavailable/unsupported/unresolved state.

## Configuration

```text
MARKET_DATA_PROVIDER=FMP
FMP_API_KEY=server-only-secret
MARKET_DATA_DAILY_REQUEST_LIMIT=25
MARKET_DATA_CACHE_TTL_MINUTES=15
MARKET_DATA_INCLUDE_FINANCIALS=false
```

Do not use a `NEXT_PUBLIC_` prefix for the API key.

Financial-statement retrieval is opt-in because it makes four additional
provider calls per security. Enable it only after raising the daily request
budget to match the selected provider plan.
