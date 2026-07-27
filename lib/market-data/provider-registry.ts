import { AlphaVantageProvider } from "@/lib/market-data/providers/alpha-vantage";
import type { CompleteMarketDataProvider } from "@/lib/market-data/types";

export function configuredMarketDataProvider(): CompleteMarketDataProvider | null {
  const provider = (
    process.env.MARKET_DATA_PROVIDER ?? "ALPHA_VANTAGE"
  ).toUpperCase();
  if (provider !== "ALPHA_VANTAGE") return null;
  const key = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  return key ? new AlphaVantageProvider(key) : null;
}

export function marketDataIsConfigured() {
  return configuredMarketDataProvider() !== null;
}
