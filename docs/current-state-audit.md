# AlphaPilot current-state audit

Audit date: 2026-07-26. This report is based on the repository contents and commands run in this workspace, not the README.

## Executive summary

AlphaPilot is a Next.js application with Clerk authentication, Prisma 7, and a Neon-backed PostgreSQL schema. A signed-in user can submit a CSV import and the server contains the code to persist an import snapshot and its holdings. The live dashboard has a database route and derives allocation and diversification values from the active snapshot.

The product is not yet end-to-end complete. The dashboard upload preview is view/remove-only rather than editable; the AI copilot still uses hard-coded mock data; there is no market-data provider, brokerage API, or scheduled job; and the migration history is unsafe for a fresh database because the first migration references `User` before the later migration creates it.

## Framework and package versions

| Area | Verified implementation |
| --- | --- |
| Framework | Next.js 16.2.11 with React 19.2.8 and TypeScript 5.9.3 |
| Styling | Tailwind CSS 4.3.3 via `@tailwindcss/postcss` |
| ORM | Prisma Client/CLI 7.9.0 using the Prisma Neon adapter |
| Database driver | `@neondatabase/serverless` 1.1.0, `pg` 8.22.0 |
| Authentication | Clerk `@clerk/nextjs` 7.6.1 |
| AI SDK | OpenAI 4.104.0 |
| Parsing/validation | Papa Parse 5.5.4 and Zod 3.25.76 |
| Tests | Vitest 4.1.10; ESLint 9 and Prettier 3 are configured for code quality |

## What currently works in code

- Public landing, About, Contact, and Dashboard routes exist. `proxy.ts` only protects `/imports`.
- Clerk sign-in/sign-up pages exist and force redirect to `/`.
- `getCurrentAppUser` creates/updates an app `User` from the authenticated Clerk user on server-side access.
- CSV parsing recognizes common ticker, quantity, price, cost-basis, market-value, company, and sector header aliases. It detects several named brokers heuristically and supports custom headers.
- The importer enforces a client-side CSV extension, 5 MB size, and parser row limit of 10,000. Server input is Zod-validated and saved in a database transaction using `createMany` for holdings.
- Import history supports scoped list, delete, restore, and CSV download endpoints.
- Dashboard totals, allocation, top concentration, and diversification score are computed from `Holding` records of the active import.

## Verified incomplete or disconnected features

- The UI says it supports a preview, but it cannot edit ticker, company, shares, cost, value, or sector. It only removes rows. The approval requirement that users can edit values is not implemented.
- `costBasis` is parsed and persisted but is omitted from the preview table. Acquisition date/tax lots are neither parsed nor modeled.
- CSV content sent to the server is not reparsed. The server trusts submitted rows after validation, while it separately stores the supplied raw CSV; therefore raw source and saved holdings can disagree.
- The dashboard route is live-data capable, but it returns an empty dashboard to unauthenticated visitors. The upload UI is available to those visitors and only later fails on the authenticated import endpoint.
- `/imports` is protected by middleware but is a static page that calls an authenticated endpoint; no authenticated user journey is tested.
- The dashboard component no longer renders `CopilotChat`; the chat component and `/api/copilot` route are currently disconnected from visible UI.
- Contact page intentionally has no working contact method or form.

## AI, market data, brokerages, and jobs

### AI

`app/api/copilot/route.ts` can call OpenAI Responses when `OPENAI_API_KEY` is set; otherwise it returns a demo response. It applies a reasonable educational/no-recommendation prompt and JSON schema response. However, `lib/copilot/portfolio-context.ts` imports hard-coded mock portfolio values. The AI does not receive the current user, portfolio, holdings, live price, or database data. Conversation history is browser localStorage only and is not persisted.

### Market data

No market-data API, provider SDK, quote cache, benchmark calculation, or refresh process exists. Current price and market value are only imported CSV fields.

### Brokerage integrations

No brokerage API/OAuth integration exists. The application only accepts CSV files. Chase PDF code and PDF packages were removed; the `Chase` enum value remains in the import API but cannot be produced by the current CSV parser.

### Background work

No cron configuration, queue, worker, Vercel Cron route, Neon Function, or scheduled refresh process exists.

## Remaining mock data and dead/duplicate code

The previously unused mock dashboard components, mock data, duplicate auth helper, serializer helper, account menu, and unused Prisma PostgreSQL adapter were removed during the foundation cleanup. The copilot context now explicitly reports that no portfolio context is connected; it no longer invents a portfolio. The copilot remains functionally incomplete because it still does not load the active user portfolio.

## Security findings

1. **High — public AI endpoint:** `/api/copilot` has no Clerk authentication, rate limit, abuse protection, or per-user quota. When an OpenAI key is configured, unauthenticated callers can consume paid model usage.
2. **High — import source retained indefinitely:** raw broker CSV content is saved in `CSVImportLog.rawCsv` without a retention policy, encryption at the application layer, or user-visible disclosure. This can contain sensitive account data.
3. **High — migration history unsafe for fresh environments:** migration `20260726000000_portfolio_imports` creates foreign keys to `User`, but `User` is created in later migration `20260726120000_init`. A fresh `prisma migrate deploy` should fail in chronological order.
4. **Medium — source/data integrity:** the import endpoint does not reparse `rawCsv` and accepts separately supplied holding rows. A client can persist holdings that do not correspond to the retained source file.
5. **Medium — no explicit API rate/size controls beyond Zod:** import has a 5 MB JSON cap and 10,000 rows but no rate limiting, concurrency control, request timeout policy, or monitoring.
6. **Medium — authorization errors are inconsistent:** several import-history handlers catch all errors and return 500 instead of a 401. Download has no catch block.
7. **Medium — financial calculations have unlabelled limitations:** imported market values are trusted as current; no as-of timestamp, currency normalization, security master, sector validation, or benchmark data exists.
8. **Low — CSV injection mitigation is incomplete:** parsed company/sector cells beginning with spreadsheet formula characters are prefixed for normalized values, but the original raw CSV is retained and downloadable unchanged.

## Environment inventory

The local environment contains keys for `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, Clerk publishable/secret keys, `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_UNPOOLED`, `OPENAI_API_KEY`, `NEON_BRANCH`, and two Neon Auth URLs. No values were inspected or recorded.

Required by runtime: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`. `OPENAI_API_KEY` is optional but makes the publicly callable copilot paid/active. `DATABASE_URL_UNPOOLED` or `DIRECT_URL` is required for migrations by `prisma.config.ts` in a real deployment. `NEXT_PUBLIC_APP_URL` is documented but not read by application code.

## Verification results

| Check | Result |
| --- | --- |
| `npm.cmd install` | Passed; dependencies already current; Prisma client generated. npm reported 8 audit vulnerabilities (2 moderate, 6 high), not investigated in this audit. |
| `npx.cmd prisma validate` | Passed. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run lint` | Passed after ESLint configuration was added. |
| `npm.cmd run test` | Passed: 2 files / 4 tests. |
| `npm.cmd run test:integration` | Not configured; npm reported missing script. |
| `npm.cmd run build` | Passed. |
| `npx.cmd prisma migrate status` | Intermittent: it succeeded immediately after reconciliation, then returned generic `Schema engine error` on later runs. Direct PostgreSQL inspection verifies the baseline migration record exists. |

No current TypeScript or production-build error was observed. Lint is configured and passing. Integration-test status cannot be claimed because no integration-test command is configured.
