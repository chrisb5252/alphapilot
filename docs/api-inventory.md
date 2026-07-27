# API inventory

All routes are Next.js route handlers. Middleware protects only `/imports`; APIs enforce authentication themselves inconsistently.

| Method and path | Auth | Current behavior | Verification/status |
| --- | --- | --- | --- |
| `POST /api/imports` | Required through `getCurrentAppUser` | Validates JSON preview rows, creates/uses a portfolio, creates an import snapshot, batch inserts holdings, and stores raw CSV. | Exists; no endpoint/integration test. |
| `GET /api/imports` | Required | Lists imports belonging to current user, optional `portfolioId`. | Exists; no endpoint test. |
| `DELETE /api/imports/:id` | Required | Deletes owned import; restores newest remaining snapshot if deleted import was active. | Exists; no endpoint test. |
| `POST /api/imports/:id/restore` | Required | Sets an owned historical snapshot active. | Exists; no endpoint test. |
| `GET /api/imports/:id/download` | Required | Downloads retained raw CSV for an owned import. | Exists; no endpoint test and no catch/error normalization. |
| `GET /api/portfolios/dashboard` | Optional/public response | For an authenticated user, finds the selected/latest portfolio and active import, then calculates dashboard values. For anonymous callers returns `{ portfolios: [], dashboard: null }`. | Exists; pure calculation unit test only. |
| `POST /api/copilot` | **Not required** | Validates a short message history, uses OpenAI if configured, otherwise returns mock demo response. Context is mock data, not database portfolio data. | Exists; no tests; not currently rendered by dashboard UI. |

## No API exists for

- Portfolio creation/renaming/deletion outside import side effect
- Holding edits, tax lots, or acquisition dates
- Import preview server parsing
- Market quotes, sectors/security metadata, benchmark comparisons, or performance history
- Broker OAuth/API connections
- Contact form submission
- AI chat persistence, per-portfolio context, quotas, feedback, or moderation
- Background-job administration or webhooks
