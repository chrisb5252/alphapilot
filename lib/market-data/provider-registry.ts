import { AlphaVantageProvider } from "@/lib/market-data/providers/alpha-vantage";
import { FmpProvider } from "@/lib/market-data/providers/fmp";
import type { CompleteMarketDataProvider } from "@/lib/market-data/types";

export function configuredMarketDataProvider(): CompleteMarketDataProvider | null {
  const provider = (process.env.MARKET_DATA_PROVIDER ?? "FMP").toUpperCase();
  if (provider === "FMP") {
    const key = process.env.FMP_API_KEY?.trim();
    return key ? new FmpProvider(key) : null;
  }
  if (provider === "ALPHA_VANTAGE") {
    const key = process.env.ALPHA_VANTAGE_API_KEY?.trim();
    return key ? new AlphaVantageProvider(key) : null;
  }
  return null;
}

export function marketDataIsConfigured() {
  return configuredMarketDataProvider() !== null;
}
