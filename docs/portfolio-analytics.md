# Deterministic portfolio analytics

AlphaPilot's first analytics engine is deliberately market-data independent. It calculates educational composition signals from the current, user-owned `Holding` records selected by the dashboard: recorded market value, cost basis availability, security type, and sector.

## Included

- Asset-class and sector allocation
- Largest holding and top-three concentration
- A transparent diversification composition score
- Cost-basis and sector-classification coverage
- Educational concentration signals and research questions

## Excluded until a licensed market-data provider is enabled

- Live or delayed quotes
- Daily performance, benchmark comparisons, correlations, news, earnings, dividends, and price targets
- Trading recommendations, rebalancing instructions, or personalized financial advice

## Diversification score

The 0–100 score begins at 100 and applies documented reductions for a large single holding, top-three concentration, sector concentration, and missing sector classification. It adds a small capped credit for the number of positive-value positions. It is a composition summary, not a risk grade or recommendation.

All calculations run in `lib/portfolio/analytics.ts` and are returned by the authenticated dashboard endpoint. The endpoint scopes holdings to `account.userId` and `isIncludedInAnalysis=true`.

Set `MARKET_DATA_ENABLED=true` only when a licensed market-data provider is ready. With the default `false`, AlphaPilot remains in analysis-only mode and does not queue provider requests.
