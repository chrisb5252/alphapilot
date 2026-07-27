# Neon migration reconciliation runbook

## Why this exists

The repository contains two migrations in unsafe chronological order:

1. `20260726000000_portfolio_imports` creates foreign keys to `User`.
2. `20260726120000_init` creates `User`.

The disposable Neon branch reset reproduced this exact failure with PostgreSQL `42P01: relation "User" does not exist`. The historical files have been replaced with one ordered baseline migration, `20260726000000_baseline`.

## Non-destructive procedure

1. Create a Neon branch named `audit-migration-reconciliation` from production. Do not link it as the local default branch and do not pull its environment into `.env.local`.
2. On production and the branch, query only:

   ```sql
   SELECT migration_name, finished_at, rolled_back_at, logs
   FROM "_prisma_migrations"
   ORDER BY started_at;
   ```

3. Capture schema-only output on both environments with `pg_dump --schema-only` using each direct/unpooled URL. Compare it with `prisma/schema.prisma` using `prisma migrate diff`.
4. Test `prisma migrate deploy` on the reset audit branch using only `20260726000000_baseline`. Verify with `prisma migrate status`, `prisma validate`, and a smoke import.
5. Back up production and record row counts. Only after approval, use `prisma migrate resolve --applied 20260726000000_baseline` on the existing production database instead of replaying baseline DDL.
7. Run the normal deploy command against the branch and verify no schema drift. Production follows only after the branch is green and an approved maintenance window exists.

## Environment rules

- Runtime/Vercel: `DATABASE_URL` must be Neon’s **pooled** connection string.
- CLI migrations: `DATABASE_URL_UNPOOLED` or `DIRECT_URL` must be Neon’s **direct** connection string.
- Never include `DATABASE_URL=` or quotation marks when pasting a Vercel secret.
- Do not emit or commit connection-string values.

## Verification record

- The disposable branch `audit-migration-reconciliation` was reset on 2026-07-26. The original history failed as expected with `42P01: relation "User" does not exist`.
- The corrected baseline migration reset and applied successfully on that branch. `prisma migrate status` then reported the schema up to date.
- A short-lived backup branch, `pre-migration-baseline-backup`, was created from production before reconciliation. It expires on 2026-08-02.
- Production was reconciled with `prisma migrate resolve --applied 20260726000000_baseline`; no baseline DDL was replayed. A direct read-only query confirms the production migration table contains the two legacy records plus `20260726000000_baseline`.
- `prisma migrate status` succeeded immediately after reconciliation but subsequently resumed failing intermittently with a generic schema-engine error. Treat Prisma CLI status as an unresolved operational issue even though the migration metadata repair is complete.
