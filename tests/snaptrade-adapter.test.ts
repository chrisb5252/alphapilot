import { describe, expect, it } from "vitest";
import { normalizeActivity, normalizePosition } from "@/lib/snaptrade/adapter";
import { decryptProviderSecret, encryptProviderSecret } from "@/lib/security/provider-secrets";

describe("SnapTrade adapter", () => {
  it("normalizes a provider position without floating-point storage math", () => {
    const result = normalizePosition({ symbol: { id: "security-1", symbol: "AAPL", description: "Apple Inc.", type: "STOCK" }, units: 1.25, price: 200.1, average_purchase_price: 180, currency: { code: "USD" } });
    expect(result).toMatchObject({ providerSecurityId: "security-1", symbol: "AAPL", quantity: "1.25", marketValue: "250.1250", securityType: "STOCK" });
  });
  it("normalizes a unified SnapTrade position response", () => {
    const result = normalizePosition({ instrument: { id: "instrument-1", symbol: "MSFT", description: "Microsoft", kind: "stock", currency: "USD" }, units: "2.5", price: "100.20", cost_basis: "95.00", currency: "USD" });
    expect(result).toMatchObject({ providerSecurityId: "instrument-1", symbol: "MSFT", quantity: "2.5", marketValue: "250.5000" });
  });
  it("normalizes provider transactions and preserves their identifier", () => {
    const result = normalizeActivity({ id: "activity-1", type: "BUY", trade_date: "2026-07-26T00:00:00Z", amount: -250.12, quantity: 1.25, price: 200.1, description: "Buy Apple", currency: { code: "USD" }, symbol: { id: "security-1", symbol: "AAPL", description: "Apple Inc." } });
    expect(result).toMatchObject({ providerTransactionId: "activity-1", type: "BUY", amount: "-250.12", security: { symbol: "AAPL" } });
  });
  it("encrypts a provider user secret at rest", () => {
    process.env.PROVIDER_SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptProviderSecret("secret-value");
    expect(encrypted).not.toContain("secret-value");
    expect(decryptProviderSecret(encrypted)).toBe("secret-value");
  });
});
