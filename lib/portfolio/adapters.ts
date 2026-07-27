export type CanonicalSecurityInput = {
  symbol?: string | null;
  providerSecurityId?: string | null;
  name: string;
  securityType?: string;
  currency?: string;
  sector?: string | null;
};
export type CanonicalHoldingInput = {
  security: CanonicalSecurityInput;
  quantity: string;
  averageCost?: string | null;
  currentPrice?: string | null;
  marketValue: string;
  currency?: string;
  asOfDate: Date;
};
export type CanonicalAccountPayload = {
  source: "CSV_IMPORT" | "PDF_IMPORT" | "SNAPTRADE" | "PLAID" | "MANUAL";
  account: {
    providerAccountId?: string;
    name: string;
    accountType: string;
    currency?: string;
  };
  holdings: CanonicalHoldingInput[];
};
export interface PortfolioProviderAdapter<T> {
  source: CanonicalAccountPayload["source"];
  normalize(input: T): CanonicalAccountPayload[];
}
export const csvAdapter: PortfolioProviderAdapter<{
  name: string;
  rows: Array<{
    symbol: string;
    companyName: string;
    shares: string;
    costBasis?: string | null;
    currentPrice?: string | null;
    marketValue: string;
    sector?: string | null;
  }>;
}> = {
  source: "CSV_IMPORT",
  normalize: (input) => [
    {
      source: "CSV_IMPORT",
      account: { name: input.name, accountType: "BROKERAGE" },
      holdings: input.rows.map((row) => ({
        security: {
          symbol: row.symbol,
          name: row.companyName || row.symbol,
          sector: row.sector,
        },
        quantity: row.shares,
        averageCost: row.costBasis,
        currentPrice: row.currentPrice,
        marketValue: row.marketValue,
        asOfDate: new Date(),
      })),
    },
  ],
};
