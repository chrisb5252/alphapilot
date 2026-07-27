# Brokerage synchronization architecture

`BrokerageConnection` is the connection state record; `InvestmentAccount`, `Security`, `Holding`, `CashBalance`, and `InvestmentTransaction` are provider-neutral records. SnapTrade-specific response shapes are confined to `lib/snaptrade/adapter.ts` and `lib/snaptrade/service.ts`. The sync uses SnapTrade's current unified positions and per-account activities APIs, not the retired legacy endpoints.

1. A signed-in user opens the server-generated SnapTrade Connection Portal.
2. The app stores the returned SnapTrade user secret encrypted using AES-256-GCM; it is never sent to the browser.
3. The portal or webhook establishes a connection. The service upserts provider accounts and replaces only that account's current SnapTrade holdings. Provider transaction IDs make transaction writes idempotent.
4. `SyncJob` records preserve job progress; `WebhookEvent` records an event ID, payload hash, status, and timestamps without retaining sensitive webhook contents.

Connection states are `PENDING`, `CONNECTING`, `INITIAL_SYNC`, `ACTIVE`, `REFRESHING`, `REAUTH_REQUIRED`, `PARTIAL`, `FAILED`, and `DISCONNECTED`. Any user-owned query scopes through the authenticated AlphaPilot user ID.

`vercel.json` invokes the authenticated `/api/internal/sync-jobs` worker every ten minutes to drain a small batch of queued `SyncJob` records. Set `CRON_SECRET` in Vercel; Vercel sends it as a bearer token to cron routes. For greater volume, move this consumer to a durable queue with retries and backoff. This keeps webhook acknowledgement fast and avoids duplicate work across Vercel instances.
