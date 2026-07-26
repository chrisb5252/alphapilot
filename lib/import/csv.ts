import Papa from "papaparse";
import type { BrokerName, ImportIssue, ParseResult, ParsedHolding } from "./types";

const HEADER_ALIASES: Record<string, string[]> = {
  symbol: ["ticker", "symbol", "stock symbol", "ticker symbol", "security symbol"],
  companyName: ["company", "name", "company name", "description", "security name", "instrument"],
  shares: ["shares", "quantity", "qty", "units", "shares held"],
  costBasis: ["average cost", "avg cost", "cost basis", "average price", "cost per share"],
  currentPrice: ["current price", "market price", "last price", "price", "last trade price"],
  marketValue: ["market value", "current value", "market val", "value", "equity value", "amount"],
  sector: ["sector", "asset class", "category"],
};

const MAX_ROWS = 10_000;

function normalizedHeader(value: string) { return value.toLowerCase().replace(/[\s_\-/.]+/g, " ").trim(); }
function safeText(value: unknown) { return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim(); }
function safeCsvCell(value: string) { return /^[=+\-@]/.test(value) ? `'${value}` : value; }

function readNumber(value: unknown): number | null {
  const raw = safeText(value).replace(/[$,%\s,]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function findColumn(headers: string[], field: string) {
  const aliases = HEADER_ALIASES[field] ?? [];
  return headers.find((header) => aliases.includes(normalizedHeader(header)));
}

function detectBroker(headers: string[]): BrokerName {
  const values = headers.map(normalizedHeader);
  if (values.includes("stock symbol") || values.includes("last trade price")) return "E*TRADE";
  if (values.includes("quantity") && values.includes("cost basis") && values.includes("market value")) return "Fidelity";
  if (values.includes("symbol") && values.includes("average cost") && values.includes("market price")) return "Robinhood";
  if (values.includes("security name") || values.includes("shares held")) return "Charles Schwab";
  if (values.includes("asset class") && values.includes("market value")) return "Vanguard";
  if (values.includes("ticker") && values.includes("qty")) return "Webull";
  return "Custom CSV";
}

export function validateHolding(row: Omit<ParsedHolding, "errors" | "warnings">): Pick<ParsedHolding, "errors" | "warnings"> {
  const errors: ImportIssue[] = [];
  const warnings: string[] = [];
  if (!row.symbol) errors.push({ field: "symbol", message: "Missing ticker symbol." });
  else if (!/^[A-Z][A-Z0-9.\-]{0,14}$/.test(row.symbol)) errors.push({ field: "symbol", message: "Ticker format is not valid." });
  if (row.shares === null) errors.push({ field: "shares", message: "Shares are required." });
  else if (row.shares <= 0) errors.push({ field: "shares", message: "Shares must be greater than zero." });
  if (row.costBasis !== null && row.costBasis < 0) errors.push({ field: "costBasis", message: "Cost basis cannot be negative." });
  if (row.currentPrice !== null && row.currentPrice < 0) errors.push({ field: "currentPrice", message: "Current price cannot be negative." });
  if (row.marketValue !== null && row.marketValue < 0) errors.push({ field: "marketValue", message: "Market value cannot be negative." });
  if (row.marketValue === null && row.currentPrice === null && row.costBasis === null) warnings.push("No value or price supplied; market value will be zero.");
  return { errors, warnings };
}

export function parsePortfolioCsv(csv: string): ParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: "greedy", transformHeader: (header) => safeText(header) });
  const headers = parsed.meta.fields?.filter(Boolean) ?? [];
  const fileErrors: string[] = [];
  if (!csv.trim()) fileErrors.push("The selected file is empty.");
  if (!headers.length) fileErrors.push("We could not find a header row in this CSV.");
  if (parsed.data.length > MAX_ROWS) fileErrors.push(`This file has more than ${MAX_ROWS.toLocaleString()} holdings. Split it into smaller files and try again.`);
  if (parsed.errors.length) fileErrors.push("The CSV has malformed rows. Review the file and try again.");
  const column = (field: string) => findColumn(headers, field);
  const symbolColumn = column("symbol");
  if (headers.length && !symbolColumn) fileErrors.push("We could not find a ticker column. Use Symbol, Ticker, or Stock Symbol.");
  const rows = parsed.data.slice(0, MAX_ROWS).map((raw, index) => {
    const base = {
      rowNumber: index + 2,
      symbol: safeText(symbolColumn ? raw[symbolColumn] : "").toUpperCase(),
      companyName: safeCsvCell(safeText(column("companyName") ? raw[column("companyName")!] : "")),
      sector: safeCsvCell(safeText(column("sector") ? raw[column("sector")!] : "")),
      shares: readNumber(column("shares") ? raw[column("shares")!] : null),
      costBasis: readNumber(column("costBasis") ? raw[column("costBasis")!] : null),
      currentPrice: readNumber(column("currentPrice") ? raw[column("currentPrice")!] : null),
      marketValue: readNumber(column("marketValue") ? raw[column("marketValue")!] : null),
    };
    const inferredValue = base.marketValue ?? (base.shares !== null && base.currentPrice !== null ? base.shares * base.currentPrice : base.shares !== null && base.costBasis !== null ? base.shares * base.costBasis : null);
    return { ...base, marketValue: inferredValue, ...validateHolding({ ...base, marketValue: inferredValue }) };
  });
  const seen = new Map<string, number>();
  rows.forEach((row, index) => { if (!row.symbol) return; const first = seen.get(row.symbol); if (first !== undefined) row.errors.push({ field: "row", message: `Duplicate ticker; also appears on row ${rows[first].rowNumber}. Combine or remove one row.` }); else seen.set(row.symbol, index); });
  return { broker: detectBroker(headers), headers, rows, fileErrors, warnings: headers.length && !column("marketValue") ? ["Market Value was not found; values were calculated from available price data where possible."] : [] };
}
