CREATE TABLE "PortfolioAnalysis" (
  "id" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "portfolioSnapshotId" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "formulaVersion" TEXT NOT NULL,
  "benchmarkKey" TEXT NOT NULL DEFAULT 'NONE',
  "benchmarkSymbol" TEXT,
  "dataTimestamp" TIMESTAMP(3) NOT NULL,
  "marketDataTimestamp" TIMESTAMP(3),
  "assumptions" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "inputHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioAnalysis_portfolioSnapshotId_engineVersion_formulaVersion_benchmarkKey_key"
  ON "PortfolioAnalysis"("portfolioSnapshotId", "engineVersion", "formulaVersion", "benchmarkKey");
CREATE INDEX "PortfolioAnalysis_portfolioId_createdAt_idx"
  ON "PortfolioAnalysis"("portfolioId", "createdAt");
CREATE INDEX "PortfolioAnalysis_portfolioId_benchmarkKey_formulaVersion_idx"
  ON "PortfolioAnalysis"("portfolioId", "benchmarkKey", "formulaVersion");

ALTER TABLE "PortfolioAnalysis"
  ADD CONSTRAINT "PortfolioAnalysis_portfolioId_fkey"
  FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioAnalysis"
  ADD CONSTRAINT "PortfolioAnalysis_portfolioSnapshotId_fkey"
  FOREIGN KEY ("portfolioSnapshotId") REFERENCES "PortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
