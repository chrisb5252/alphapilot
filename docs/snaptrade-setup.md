# SnapTrade setup

AlphaPilot uses SnapTrade's **Commercial** API flow for read-only account data. It does not create, preview, or submit orders.

## Dashboard setup

1. Create a Commercial SnapTrade account, enable two-factor authentication, and create a test API key.
2. Add the required server-side environment variables to local development and Vercel: `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`, `SNAPTRADE_ENVIRONMENT`, `APP_URL`, and `PROVIDER_SECRETS_ENCRYPTION_KEY`.
3. Set the SnapTrade Connection Portal return URL to `https://your-domain/settings/brokerages`.
4. Configure the webhook URL as `https://your-domain/api/webhooks/snaptrade`.

`PROVIDER_SECRETS_ENCRYPTION_KEY` must be a base64-encoded 32-byte key and must remain stable. Rotating it requires a planned decrypt/re-encrypt migration. Never add any SnapTrade secret as a `NEXT_PUBLIC_` variable.

## Local and sandbox testing

Use a SnapTrade test key and set `APP_URL=http://localhost:3000`. Use a public HTTPS tunnel for webhooks; SnapTrade cannot deliver webhooks to localhost. The automated test suite uses only fixtures and does not require provider credentials.

## Production readiness

Complete SnapTrade's production approval and billing steps, configure the production URL and webhook, and use a durable job worker to drain `SyncJob` records created by webhooks. The current app queues webhook work and permits a user-triggered sync; Vercel route handlers should not perform a full sync while acknowledging a webhook.

Data freshness varies by SnapTrade plan and brokerage. The product must show the stored “last updated” time and must not describe connected holdings as real time. Brokerage support, account categories, position detail, and transaction history differ by institution; unsupported or empty accounts remain visible with a clear status.
