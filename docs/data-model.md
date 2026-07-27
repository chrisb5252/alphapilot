# Data model

## Normalized portfolio foundation (2026-07-26)

The normalized foundation is implemented in `20260727000000_normalize_portfolio_data`. It preserves prior CSV import snapshots by renaming the old `Holding` table to `ImportedHolding`, then creates a new current-position `Holding` table keyed by `InvestmentAccount` and `Security`.

New top-level entities: `DataSource`, `BrokerageConnection`, `InvestmentAccount`, `Security`, `Holding`, `CashBalance`, `InvestmentTransaction`, `PortfolioSnapshot`, `HoldingSnapshot`, `ImportJob`, `SyncJob`, `PortfolioInsight`, `InsightEvidence`, `Watchlist`, `WatchlistSecurity`, `AlertRule`, and `AlertEvent`.

All money fields use `DECIMAL(24,4)` and quantities/prices use `DECIMAL(24,10)`. Current positions are unique per account/security; provider transaction and account identifiers are unique within a user/account scope. Securities permit a null symbol and can instead use provider identifiers, CUSIP, ISIN, or SEDOL.

Existing portfolios receive a deterministic imported account. Securities and current holdings are backfilled only from each portfolio's active legacy import. Earlier import snapshots and raw CSV logs remain intact for compatibility.

Source of truth: `prisma/schema.prisma`.

```text
Clerk user ID
   │
   └── User (application profile)
         └── Portfolio (many)
               ├── ImportHistory (many snapshots)
               │     ├── Holding (many per snapshot)
               │     └── CSVImportLog (zero or one)
               └── Holding (many; each also belongs to an ImportHistory)
```

## Models

| Model           | Key fields                                                                                           | Relationships                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `User`          | `id`, unique `clerkId`, unique `email`, profile fields                                               | Owns many portfolios. Created lazily by `getCurrentAppUser`.                                                                            |
| `Portfolio`     | `id`, `userId`, `name`, `currency`                                                                   | Belongs to one user; has many holdings and imports.                                                                                     |
| `ImportHistory` | broker, filename, SHA-256 fingerprint, holding count, portfolio value, status, `isActive`, timestamp | A snapshot within a portfolio; owns many holdings and one optional CSV log. Exact CSV fingerprint unique per portfolio.                 |
| `Holding`       | symbol, company, sector, shares, cost basis, current price, market value                             | Belongs to both a portfolio and import snapshot. Unique `symbol` per import, so multiple tax lots for the same security are impossible. |
| `CSVImportLog`  | raw CSV, detected headers, warnings, error count                                                     | One-to-one with import history.                                                                                                         |

## Constraints and semantics

- Deleting a `User` cascades to portfolios, imports, holdings, and logs through relational chains.
- An import restore toggles `isActive`; it does not copy holdings.
- A portfolio may contain historical holdings from all imports; dashboard code selects holdings only through the active import.
- Decimal precision: shares `(18,6)` and monetary fields `(18,4)`.
- `costBasis` represents a per-share amount in dashboard calculations (`costBasis * shares`), although the header alias also accepts "Cost Basis," which commonly means total basis. This is a semantic ambiguity.

## Model gaps

- No acquisition date, tax lot, source as-of date, broker account, security identifier (CUSIP/ISIN), asset type, currency conversion, transaction, benchmark, or quote-history model.
- No AI conversation, analysis result, audit event, deletion-request, consent, or retention model.
- No database constraint permits only one active import per portfolio; application code attempts to enforce this transactionally.
- The migration ordering is invalid for a new database: the portfolio/import migration references `User` before the init migration creates it.
# SnapTrade additions

The additive `20260728000000_snaptrade_connections` migration introduces encrypted provider user credentials and operational connection metadata on `BrokerageConnection`, local account labels on `InvestmentAccount`, sync counters/diagnostics on `SyncJob`, and the idempotent `WebhookEvent` ledger. It preserves existing legacy import rows and normalized holdings.
