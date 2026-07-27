-- Additive SnapTrade connection state. Existing CSV/PDF import data is preserved.
CREATE TYPE "BrokerageSyncStatus" AS ENUM ('PENDING', 'CONNECTING', 'INITIAL_SYNC', 'ACTIVE', 'REFRESHING', 'REAUTH_REQUIRED', 'PARTIAL', 'FAILED', 'DISCONNECTED');
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSED', 'REJECTED', 'FAILED');

ALTER TABLE "BrokerageConnection"
  ADD COLUMN "providerUserSecretEncrypted" TEXT,
  ADD COLUMN "accountsSynchronized" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "holdingsSynchronized" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "transactionsSynchronized" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "safeErrorMessage" TEXT,
  ADD COLUMN "diagnosticId" TEXT;

ALTER TABLE "BrokerageConnection"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "BrokerageSyncStatus" USING (
    CASE "status"::text
      WHEN 'CONNECTED' THEN 'ACTIVE'
      WHEN 'DISCONNECTED' THEN 'DISCONNECTED'
      WHEN 'REQUIRES_REAUTH' THEN 'REAUTH_REQUIRED'
      WHEN 'ERROR' THEN 'FAILED'
      ELSE 'PENDING'
    END
  )::"BrokerageSyncStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "InvestmentAccount" ADD COLUMN "localName" TEXT;
ALTER TABLE "SyncJob"
  ADD COLUMN "diagnosticId" TEXT,
  ADD COLUMN "attemptedAccounts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "synchronizedAccounts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "synchronizedHoldings" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "synchronizedTransactions" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "DataProvider" NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerUserId" TEXT,
  "brokerageConnectionId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "diagnosticId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");
CREATE INDEX "WebhookEvent_provider_status_receivedAt_idx" ON "WebhookEvent"("provider", "status", "receivedAt");
CREATE INDEX "WebhookEvent_providerUserId_idx" ON "WebhookEvent"("providerUserId");
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_brokerageConnectionId_fkey" FOREIGN KEY ("brokerageConnectionId") REFERENCES "BrokerageConnection"("id") ON DELETE SET NULL;
