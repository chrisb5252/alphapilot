# Archived invalid migration history

The original two migrations were replaced on 2026-07-26 by `20260726000000_baseline` after a disposable Neon reset verified that the original sequence failed with PostgreSQL error `42P01: relation "User" does not exist`.

The replaced directories were:

- `20260726000000_portfolio_imports` — created portfolio tables and foreign keys to `User`.
- `20260726120000_init` — created `User` after the dependent migration.

The code is intentionally not retained under `prisma/migrations`, because Prisma treats every migration directory there as deployable. Git history preserves the exact prior SQL.

## Production reconciliation required

Existing databases with the old migration records must be backed up and then explicitly baselined with `prisma migrate resolve --applied 20260726000000_baseline` using the production direct Neon URL. Do **not** run `prisma migrate deploy` against such a database before the baseline is marked applied, because it would attempt to recreate existing tables.
