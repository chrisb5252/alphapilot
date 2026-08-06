-- Simulated portfolios are intentionally separate from brokerage and imported data.
CREATE TYPE "PaperTransactionType" AS ENUM ('BUY', 'SELL');

CREATE TABLE "PaperPortfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startingCashUSD" DECIMAL(24,10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaperPortfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperPosition" (
    "id" TEXT NOT NULL,
    "paperPortfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "shares" DECIMAL(24,10) NOT NULL,
    "avgCostBasis" DECIMAL(24,10) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaperPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperTransaction" (
    "id" TEXT NOT NULL,
    "paperPortfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "type" "PaperTransactionType" NOT NULL,
    "shares" DECIMAL(24,10) NOT NULL,
    "priceAtAction" DECIMAL(24,10) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperSnapshot" (
    "id" TEXT NOT NULL,
    "paperPortfolioId" TEXT NOT NULL,
    "totalValueUSD" DECIMAL(24,10) NOT NULL,
    "cashUSD" DECIMAL(24,10) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaperPosition_paperPortfolioId_ticker_key" ON "PaperPosition"("paperPortfolioId", "ticker");
CREATE UNIQUE INDEX "PaperSnapshot_paperPortfolioId_timestamp_key" ON "PaperSnapshot"("paperPortfolioId", "timestamp");
CREATE INDEX "PaperPortfolio_userId_updatedAt_idx" ON "PaperPortfolio"("userId", "updatedAt");
CREATE INDEX "PaperPosition_paperPortfolioId_updatedAt_idx" ON "PaperPosition"("paperPortfolioId", "updatedAt");
CREATE INDEX "PaperTransaction_paperPortfolioId_timestamp_idx" ON "PaperTransaction"("paperPortfolioId", "timestamp");
CREATE INDEX "PaperSnapshot_paperPortfolioId_timestamp_idx" ON "PaperSnapshot"("paperPortfolioId", "timestamp");

ALTER TABLE "PaperPortfolio" ADD CONSTRAINT "PaperPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperPosition" ADD CONSTRAINT "PaperPosition_paperPortfolioId_fkey" FOREIGN KEY ("paperPortfolioId") REFERENCES "PaperPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperTransaction" ADD CONSTRAINT "PaperTransaction_paperPortfolioId_fkey" FOREIGN KEY ("paperPortfolioId") REFERENCES "PaperPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperSnapshot" ADD CONSTRAINT "PaperSnapshot_paperPortfolioId_fkey" FOREIGN KEY ("paperPortfolioId") REFERENCES "PaperPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
