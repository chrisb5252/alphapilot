-- Add FMP without modifying any existing market-data records.
ALTER TYPE "MarketDataProviderName" ADD VALUE IF NOT EXISTS 'FMP';
