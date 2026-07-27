import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

const numberString = z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/)]).transform(String);
const positionSchema = z.object({
  symbol: z.object({ symbol: z.string().optional(), description: z.string().optional(), id: z.string().optional(), type: z.string().optional() }).nullable().optional(),
  units: numberString.nullable().optional(), price: numberString.nullable().optional(), average_purchase_price: numberString.nullable().optional(),
  currency: z.object({ code: z.string().optional() }).nullable().optional(),
});
const unifiedPositionSchema = z.object({
  instrument: z.object({ id: z.string().optional(), symbol: z.string().optional(), description: z.string().nullable().optional(), kind: z.string().optional(), currency: z.string().nullable().optional() }).nullable().optional(),
  units: numberString.nullable().optional(), price: numberString.nullable().optional(), cost_basis: numberString.nullable().optional(), currency: z.string().nullable().optional(),
});
const activitySchema = z.object({
  id: z.string().nullable().optional(), type: z.string().nullable().optional(), description: z.string().nullable().optional(), date: z.string().nullable().optional(), trade_date: z.string().nullable().optional(), settlement_date: z.string().nullable().optional(), amount: numberString.nullable().optional(), quantity: numberString.nullable().optional(), price: numberString.nullable().optional(), fee: numberString.nullable().optional(), currency: z.object({ code: z.string().nullable().optional() }).nullable().optional(), symbol: z.object({ symbol: z.string().nullable().optional(), description: z.string().nullable().optional(), id: z.string().nullable().optional(), type: z.union([z.string(), z.object({ code: z.string().nullable().optional(), description: z.string().nullable().optional() })]).nullable().optional() }).nullable().optional(),
});

export type SnapTradePosition = ReturnType<typeof normalizePosition>;
export function normalizePosition(input: unknown) {
  const unified = unifiedPositionSchema.safeParse(input);
  if (unified.success) {
    const position = unified.data;
    const symbol = position.instrument?.symbol?.trim() || undefined;
    const quantity = position.units ?? "0";
    const price = position.price ?? undefined;
    const marketValue = price ? new Decimal(quantity).mul(new Decimal(price)).toFixed(4) : "0";
    return { providerSecurityId: position.instrument?.id, symbol, name: position.instrument?.description || symbol || "Unnamed security", securityType: securityType(position.instrument?.kind), quantity, averageCost: position.cost_basis ?? undefined, currentPrice: price, marketValue, currency: position.currency || position.instrument?.currency || "USD" };
  }
  const position = positionSchema.parse(input);
  const symbol = position.symbol?.symbol?.trim() || undefined;
  const quantity = position.units ?? "0";
  const price = position.price ?? undefined;
  const marketValue = price ? new Decimal(quantity).mul(new Decimal(price)).toFixed(4) : "0";
  return { providerSecurityId: position.symbol?.id, symbol, name: position.symbol?.description || symbol || "Unnamed security", securityType: securityType(position.symbol?.type), quantity, averageCost: position.average_purchase_price ?? undefined, currentPrice: price, marketValue, currency: position.currency?.code || "USD" };
}
export function normalizeActivity(input: unknown) {
  const activity = activitySchema.parse(input);
  const symbol = activity.symbol?.symbol?.trim() || undefined;
  return { providerTransactionId: activity.id ?? undefined, type: transactionType(activity.type ?? undefined), subtype: activity.type ?? undefined, tradeDate: dateOrNow(activity.trade_date ?? activity.date ?? new Date().toISOString()), settlementDate: activity.settlement_date ? dateOrNow(activity.settlement_date) : null, quantity: activity.quantity ?? null, price: activity.price ?? null, amount: activity.amount ?? "0", fees: activity.fee ?? null, currency: activity.currency?.code || "USD", description: activity.description || activity.type || "Brokerage activity", security: symbol ? { providerSecurityId: activity.symbol?.id ?? undefined, symbol, name: activity.symbol?.description || symbol, securityType: securityType(symbolTypeCode(activity.symbol?.type)) } : null };
}
function securityType(type?: string) { const value = type?.toUpperCase() ?? ""; return value === "ET" || value.includes("ETF") ? "ETF" : value === "OEF" || value.includes("MUTUAL") ? "MUTUAL_FUND" : value.includes("OPTION") ? "OPTION" : value === "CRYPTO" || value.includes("CRYPTO") ? "CRYPTO" : value === "BND" || value.includes("BOND") || value.includes("FIXED") ? "FIXED_INCOME" : "STOCK"; }
function transactionType(type?: string) { const value = type?.toUpperCase() ?? ""; if (value.includes("BUY")) return "BUY"; if (value.includes("SELL")) return "SELL"; if (value.includes("DIVIDEND")) return "DIVIDEND"; if (value.includes("INTEREST")) return "INTEREST"; if (value.includes("FEE")) return "FEE"; if (value.includes("DEPOSIT")) return "DEPOSIT"; if (value.includes("WITHDRAW")) return "WITHDRAWAL"; if (value.includes("TRANSFER")) return "TRANSFER"; return "OTHER"; }
function symbolTypeCode(value: string | { code?: string | null } | null | undefined) { return typeof value === "string" ? value : value?.code ?? undefined; }
function dateOrNow(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? new Date() : date; }
