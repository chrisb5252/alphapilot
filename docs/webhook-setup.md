# SnapTrade webhooks

Configure `POST /api/webhooks/snaptrade` in the SnapTrade dashboard. The endpoint validates SnapTrade's `Signature` header using an HMAC SHA-256 over canonical JSON with `SNAPTRADE_CONSUMER_KEY`; SnapTrade documents that the older webhook secret is deprecated. Events older than five minutes are rejected to reduce replay risk.

The handler deduplicates on `(provider, webhookId)`, stores only a SHA-256 payload hash and metadata, and creates a pending sync job for connection and holdings/transaction update events. Do not log complete payloads, account identifiers, or credentials.

Before production, send a signed test event from the SnapTrade dashboard, confirm a `WebhookEvent` record is created, and verify the queue worker completes the corresponding sync job. Configure monitoring for rejected signatures, failed events, and stale pending jobs.
