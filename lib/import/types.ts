export type BrokerName =
  | "Robinhood"
  | "Fidelity"
  | "Charles Schwab"
  | "Vanguard"
  | "E*TRADE"
  | "Webull"
  | "Chase"
  | "Custom CSV";

export type ImportIssue = {
  field:
    "symbol" | "shares" | "costBasis" | "currentPrice" | "marketValue" | "row";
  message: string;
};

export type ParsedHolding = {
  rowNumber: number;
  symbol: string;
  companyName: string;
  sector: string;
  shares: number | null;
  costBasis: number | null;
  currentPrice: number | null;
  marketValue: number | null;
  errors: ImportIssue[];
  warnings: string[];
};

export type ParseResult = {
  broker: BrokerName;
  headers: string[];
  rows: ParsedHolding[];
  fileErrors: string[];
  warnings: string[];
};

export type ImportPreviewRow = Omit<ParsedHolding, "errors" | "warnings">;
