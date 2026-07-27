# Analytics methodology

The analytics engine (`1.0.0`) accepts a canonical portfolio snapshot and persists a versioned JSON result. All totals, allocations, coverage, concentration, and diversification calculations use Prisma's decimal runtime; decimal values are persisted as strings.

The calculation includes only included accounts and records assumptions, snapshot ID, engine version, formula version, and data timestamp. Risk and benchmark metrics are omitted with `INSUFFICIENT_DATA` rather than shown as zero.

Recalculate through `POST /api/portfolios/:id/analysis`. Imports, syncs, account-inclusion updates, security resolution, benchmark changes, and formula-version changes should enqueue this endpoint/job in the workflow that performs the change.
