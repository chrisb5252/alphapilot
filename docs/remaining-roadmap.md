# Remaining roadmap

This is the recommended implementation order after the audit. It intentionally starts with reliability and data protection before adding investment features.

## 0. Decisions requiring founder approval

1. Confirm whether AlphaPilot should remain a public marketing site with sign-in required only for private portfolio functions, or require login before upload starts.
2. Decide whether raw broker CSVs may be retained. Recommended default: retain normalized holdings only, or encrypt raw files and add a clear retention/deletion policy.
3. Decide the cost-basis meaning: per-share average cost versus total lot basis. For accurate tax information, approve a tax-lot data model with acquisition date.
4. Choose a licensed market-data provider and budget before showing live prices, daily performance, news, or S&P 500 comparisons.
5. Decide whether AI chat should be public. Recommended: require sign-in, apply rate limits, and scope every response to the user’s selected portfolio.

## 1. Stabilize foundations (first)

1. **Completed:** migration history was replaced with an ordered baseline, verified on a reset isolated Neon branch, and reconciled in production without replaying DDL. Keep the backup branch until its expiry or until a production smoke test is complete.
2. **Partially completed:** runtime database validation distinguishes invalid URLs and the schema/migration baseline is reconciled. Prisma CLI `migrate status` remains intermittently affected by a generic schema-engine error; diagnose this before relying on it in CI. Verify Vercel production settings still use the pooled runtime URL and direct migration URL before the next deploy.
3. **Completed:** ESLint, a `lint` script, and Prettier formatting were added for the compressed import and route components.
4. **Completed:** unused mock dashboard components, adapter, and duplicate helpers were removed. Wire the remaining copilot to the live dashboard DTO rather than restoring mock data.
5. **Partially completed:** structured error IDs, runtime database URL validation, environment-status checks, and `/api/health` were added. Add centralized monitoring/alerting next.

## 2. Make imports trustworthy

1. Move parsing/normalization to the server or reparse the submitted raw CSV server-side; persist a validated canonical representation.
2. Finish the preview: editable fields, revalidation after edits, row-level reasons, user-selected portfolio name, and a clear authenticated gate before file selection/save.
3. Define a canonical broker mapping test corpus for Robinhood, Fidelity, Schwab, Vanguard, E*TRADE, Webull, and custom CSVs.
4. Add acquisition-date/tax-lot support if approved; otherwise explicitly label cost basis as average cost per share and reject ambiguous total-basis formats.
5. Add test coverage for database transactions, owner isolation, restore/delete behavior, malformed imports, 10,000-row performance, and CSV injection.

## 3. Secure production use

1. Require authentication and rate limiting for AI and all sensitive actions; set user/usage quotas.
2. Add a data-retention/deletion workflow, consent language, audit events, encrypted storage strategy, and privacy policy.
3. Add API request size limits, rate limits, observability, alerting, and error monitoring.
4. Review compliance language with counsel before any production marketing claims; keep educational/no-advice controls in UI and AI prompt tests.

## 4. Real portfolio intelligence

1. Connect AI context to active imported holdings and persist user-scoped conversations only if approved.
2. Add a security/sector metadata provider and asset classification cache.
3. Add licensed market data with as-of timestamps, quote refresh policy, caching, and source disclosures.
4. Only after market data is reliable, add S&P 500 comparison and historical performance; do not manufacture a performance chart from a one-time import.
5. Add transparent diversification/risk methodology and tests; present educational signals rather than recommendations.

## 5. Product polish and scale

1. Support multiple named portfolios and portfolio selector/management UI.
2. Replace Contact placeholder with a real, protected support channel.
3. Add background jobs only when quote refresh, import processing, or notifications need them; use a queue/cron with idempotency and audit logging.
4. Add CI to run install, schema validation, lint, typecheck, unit tests, integration tests, and build against an isolated Neon branch.
