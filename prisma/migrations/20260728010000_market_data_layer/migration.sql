-- Provider-neutral market data, security resolution, provenance, caching, and jobs.
-- This migration is additive and leaves existing portfolio and holding data intact.

CREATE TYPE "MarketDataProviderName" AS ENUM ('ALPHA_VANTAGE');
CREATE TYPE "SecurityResolutionStatus" AS ENUM ('RESOLVED', 'AMBIGUOUS', 'UNRESOLVED', 'UNSUPPORTED');
CREATE TYPE "MarketDataStatus" AS ENUM ('REAL_TIME', 'DELAYED', 'END_OF_DAY', 'STALE', 'UNAVAILABLE', 'UNSUPPORTED', 'PROVIDER_FAILURE');
CREATE TYPE "CorporateEventType" AS ENUM ('DIVIDEND', 'EARNINGS', 'SPLIT');
CREATE TYPE "MarketDataJobType" AS ENUM ('SECURITY_ENRICHMENT', 'QUOTE_REFRESH', 'HISTORICAL_PRICE_BACKFILL', 'CORPORATE_EVENT_REFRESH', 'RESOLUTION_RETRY');

CREATE TABLE "MarketSecurityResolution" (
  "id" TEXT NOT NULL,
  "securityId" TEXT NOT NULL,
  "provider" "MarketDataProviderName" NOT NULL,
  "providerSecurityId" TEXT,
  "providerSymbol" TEXT,
  "confidence" DECIMAL(5,4) NOT NULL,
  "status" "SecurityResolutionStatus" NOT NULL,
  "source" TEXT NOT NULL,
  "evidence" JSONB,
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketSecurityResolution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketQuote" (
  "id" TEXT NOT NULL,
  "securityId" TEXT NOT NULL,
  "provider" "MarketDataProviderName" NOT NULL,
  "price" DECIMAL(24,10),
  "currency" TEXT,
  "previousClose" DECIMAL(24,10),
  "change" DECIMAL(24,10),
  "changePercent" DECIMAL(18,8),
  "marketTimestamp" TIMESTAMP(3),
  "providerTimestamp" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataStatus" "MarketDataStatus" NOT NULL DEFAULT 'UNAVAILABLE',
  "transformationMethod" TEXT NOT NULL DEFAULT 'provider_normalized',
  "provenance" JSONB,
  CONSTRAINT "MarketQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HistoricalPrice" (
  "id" TEXT NOT NULL,
  "securityId" TEXT NOT NULL,
  "provider" "MarketDataProviderName" NOT NULL,
  "tradingDate" TIMESTAMP(3) NOT NULL,
  "open" DECIMAL(24,10),
  "high" DECIMAL(24,10),
  "low" DECIMAL(24,10),
  "close" DECIMAL(24,10),
  "adjustedClose" DECIMAL(24,10),
  "volume" DECIMAL(28,0),
  "currency" TEXT,
  "isAdjusted" BOOLEAN NOT NULL DEFAULT false,
  "marketTimestamp" TIMESTAMP(3),
  "providerTimestamp" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "transformationMethod" TEXT NOT NULL DEFAULT 'provider_normalized',
  "provenance" JSONB,
  CONSTRAINT "HistoricalPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityEnrichment" (
  "id" TEXT NOT NULL,
  "securityId" TEXT NOT NULL,
  "provider" "MarketDataProviderName" NOT NULL,
  "assetClass" TEXT,
  "sector" TEXT,
  "industry" TEXT,
  "country" TEXT,
  "exchange" TEXT,
  "marketCap" DECIMAL(28,4),
  "fundCategory" TEXT,
  "expenseRatio" DECIMAL(18,8),
  "dividendYield" DECIMAL(18,8),
  "beta" DECIMAL(18,8),
  "profile" JSONB,
  "fundamentals" JSONB,
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerTimestamp" TIMESTAMP(3),
  "transformationMethod" TEXT NOT NULL DEFAULT 'provider_normalized',
  "provenance" JSONB,
  CONSTRAINT "SecurityEnrichment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorporateEvent" (
  "id" TEXT NOT NULL,
  "securityId" TEXT NOT NULL,
  "provider" "MarketDataProviderName" NOT NULL,
  "providerEventId" TEXT,
  "type" "CorporateEventType" NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "announcedAt" TIMESTAMP(3),
  "amount" DECIMAL(24,10),
  "currency" TEXT,
  "metadata" JSONB,
  "marketTimestamp" TIMESTAMP(3),
  "providerTimestamp" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "transformationMethod" TEXT NOT NULL DEFAULT 'provider_normalized',
  CONSTRAINT "CorporateEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketNewsItem" (
  "id" TEXT NOT NULL,
  "securityId" TEXT NOT NULL,
  "provider" "MarketDataProviderName" NOT NULL,
  "providerArticleId" TEXT NOT NULL,
  "sourceName" TEXT,
  "sourceUrl" TEXT,
  "headline" TEXT NOT NULL,
  "summary" TEXT,
  "publishedAt" TIMESTAMP(3),
  "providerTimestamp" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "MarketNewsItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketDataJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "portfolioId" TEXT,
  "securityId" TEXT,
  "provider" "MarketDataProviderName",
  "type" "MarketDataJobType" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "payload" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketDataJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketDataUsage" (
  "id" TEXT NOT NULL,
  "provider" "MarketDataProviderName" NOT NULL,
  "usageDate" TIMESTAMP(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "rateLimitedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketDataUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketSecurityResolution_securityId_provider_key" ON "MarketSecurityResolution"("securityId", "provider");
CREATE INDEX "MarketSecurityResolution_provider_providerSecurityId_idx" ON "MarketSecurityResolution"("provider", "providerSecurityId");
CREATE INDEX "MarketSecurityResolution_provider_providerSymbol_idx" ON "MarketSecurityResolution"("provider", "providerSymbol");
CREATE INDEX "MarketSecurityResolution_status_updatedAt_idx" ON "MarketSecurityResolution"("status", "updatedAt");
CREATE UNIQUE INDEX "MarketQuote_securityId_provider_key" ON "MarketQuote"("securityId", "provider");
CREATE INDEX "MarketQuote_provider_retrievedAt_idx" ON "MarketQuote"("provider", "retrievedAt");
CREATE INDEX "MarketQuote_securityId_dataStatus_idx" ON "MarketQuote"("securityId", "dataStatus");
CREATE UNIQUE INDEX "HistoricalPrice_securityId_provider_tradingDate_isAdjusted_key" ON "HistoricalPrice"("securityId", "provider", "tradingDate", "isAdjusted");
CREATE INDEX "HistoricalPrice_securityId_tradingDate_idx" ON "HistoricalPrice"("securityId", "tradingDate");
CREATE INDEX "HistoricalPrice_provider_retrievedAt_idx" ON "HistoricalPrice"("provider", "retrievedAt");
CREATE UNIQUE INDEX "SecurityEnrichment_securityId_provider_key" ON "SecurityEnrichment"("securityId", "provider");
CREATE INDEX "SecurityEnrichment_provider_retrievedAt_idx" ON "SecurityEnrichment"("provider", "retrievedAt");
CREATE UNIQUE INDEX "CorporateEvent_securityId_provider_type_eventDate_providerEventId_key" ON "CorporateEvent"("securityId", "provider", "type", "eventDate", "providerEventId");
CREATE INDEX "CorporateEvent_securityId_eventDate_idx" ON "CorporateEvent"("securityId", "eventDate");
CREATE INDEX "CorporateEvent_provider_retrievedAt_idx" ON "CorporateEvent"("provider", "retrievedAt");
CREATE UNIQUE INDEX "MarketNewsItem_securityId_provider_providerArticleId_key" ON "MarketNewsItem"("securityId", "provider", "providerArticleId");
CREATE INDEX "MarketNewsItem_securityId_publishedAt_idx" ON "MarketNewsItem"("securityId", "publishedAt");
CREATE INDEX "MarketNewsItem_provider_retrievedAt_idx" ON "MarketNewsItem"("provider", "retrievedAt");
CREATE INDEX "MarketDataJob_status_notBefore_createdAt_idx" ON "MarketDataJob"("status", "notBefore", "createdAt");
CREATE INDEX "MarketDataJob_securityId_type_status_idx" ON "MarketDataJob"("securityId", "type", "status");
CREATE INDEX "MarketDataJob_portfolioId_type_status_idx" ON "MarketDataJob"("portfolioId", "type", "status");
CREATE UNIQUE INDEX "MarketDataUsage_provider_usageDate_key" ON "MarketDataUsage"("provider", "usageDate");
CREATE INDEX "MarketDataUsage_provider_usageDate_idx" ON "MarketDataUsage"("provider", "usageDate");

ALTER TABLE "MarketSecurityResolution" ADD CONSTRAINT "MarketSecurityResolution_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketQuote" ADD CONSTRAINT "MarketQuote_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistoricalPrice" ADD CONSTRAINT "HistoricalPrice_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityEnrichment" ADD CONSTRAINT "SecurityEnrichment_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporateEvent" ADD CONSTRAINT "CorporateEvent_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketNewsItem" ADD CONSTRAINT "MarketNewsItem_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketDataJob" ADD CONSTRAINT "MarketDataJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketDataJob" ADD CONSTRAINT "MarketDataJob_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketDataJob" ADD CONSTRAINT "MarketDataJob_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;
