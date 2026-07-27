import { Snaptrade, SnaptradeAuth } from "snaptrade-typescript-sdk";

export function snaptradeClient() {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  if (!clientId || !consumerKey) throw new Error("SnapTrade is not configured. Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.");
  return new Snaptrade({ auth: SnaptradeAuth.commercialApiKey({ clientId, consumerKey }) });
}

export function snaptradeEnabled() {
  return Boolean(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY && process.env.PROVIDER_SECRETS_ENCRYPTION_KEY);
}

export function snaptradeIsTestEnvironment() {
  return (process.env.SNAPTRADE_ENVIRONMENT ?? "sandbox").toLowerCase() !== "production";
}
