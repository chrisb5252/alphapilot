import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "@/lib/prisma";
import { decryptProviderSecret, encryptProviderSecret } from "@/lib/security/provider-secrets";
import { normalizeActivity, normalizePosition } from "@/lib/snaptrade/adapter";
import { snaptradeClient, snaptradeIsTestEnvironment } from "@/lib/snaptrade/client";

type ProviderRecord = Record<string, unknown>;
const provider = "SNAPTRADE" as const;

function appUserId(userId: string) { return `alphapilot_${userId}`; }
function diagnosticId() { return `st_${crypto.randomUUID()}`; }
function providerError(error: unknown) { const status = typeof error === "object" && error && "status" in error ? String((error as { status?: unknown }).status ?? "") : ""; const stepMessage = error instanceof Error && error.message.startsWith("SnapTrade ") ? error.message : null; return { code: status || "SNAPTRADE_ERROR", safeMessage: status === "429" ? "SnapTrade is busy. Please try again shortly." : stepMessage ?? "We could not update this brokerage connection. Please try again or repair the connection.", diagnosticId: diagnosticId() }; }

export async function ensureSnapTradeUser(userId: string) {
  const existing = await prisma.brokerageConnection.findFirst({ where: { userId, provider, providerConnectionId: null, providerUserSecretEncrypted: { not: null } } });
  if (existing?.providerUserId && existing.providerUserSecretEncrypted) return { providerUserId: existing.providerUserId, userSecret: decryptProviderSecret(existing.providerUserSecretEncrypted) };
  const providerUserId = appUserId(userId);
  const client = snaptradeClient();
  try {
    const response = await client.authentication.registerSnapTradeUser({ userId: providerUserId });
    const data = response.data;
    const secret = required(data.userSecret, "SnapTrade user secret");
    const registration = await prisma.brokerageConnection.create({ data: { userId, provider, providerUserId: data.userId || providerUserId, providerUserSecretEncrypted: encryptProviderSecret(secret), brokerageName: "SnapTrade", status: "PENDING" } });
    return { providerUserId: registration.providerUserId!, userSecret: secret };
  } catch (error) {
    // Registering the same immutable user can be reported by the provider; never overwrite an existing secret.
    const saved = await prisma.brokerageConnection.findFirst({ where: { userId, provider, providerConnectionId: null, providerUserSecretEncrypted: { not: null } } });
    if (saved?.providerUserId && saved.providerUserSecretEncrypted) return { providerUserId: saved.providerUserId, userSecret: decryptProviderSecret(saved.providerUserSecretEncrypted) };
    throw error;
  }
}

export async function createConnectionPortal(userId: string, broker?: string, reconnect?: string) {
  if (broker === "SANDBOX" && !snaptradeIsTestEnvironment()) throw new Error("SnapTrade Sandbox is only available with test credentials.");
  const user = await ensureSnapTradeUser(userId);
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("APP_URL is required for the SnapTrade connection return.");
  const response = await snaptradeClient().authentication.loginSnapTradeUser({ userId: user.providerUserId, userSecret: user.userSecret, ...(broker ? { broker } : {}), ...(reconnect ? { reconnect } : {}), connectionType: "read", immediateRedirect: true, customRedirect: `${appUrl}/settings/brokerages?connected=snaptrade` });
  return required((response.data as { redirectURI?: string }).redirectURI, "SnapTrade portal URL");
}

export async function syncSnapTradeConnections(userId: string) {
  const credentials = await ensureSnapTradeUser(userId);
  const client = snaptradeClient();
  const result = await client.connections.listBrokerageAuthorizations({ userId: credentials.providerUserId, userSecret: credentials.userSecret });
  const connections = Array.isArray(result.data) ? result.data as ProviderRecord[] : [];
  const synced = [];
  for (const item of connections) {
    const providerConnectionId = stringValue(item.id) || stringValue(item.brokerage_authorization_id);
    if (!providerConnectionId) continue;
    const brokerageName = stringValue(item.brokerage_name) || stringValue(item.brokerage) || "Connected brokerage";
    const status = item.disabled === true ? "REAUTH_REQUIRED" : "INITIAL_SYNC";
    const connection = await prisma.brokerageConnection.upsert({
      where: { userId_provider_providerConnectionId: { userId, provider, providerConnectionId } },
      create: { userId, provider, providerUserId: credentials.providerUserId, providerConnectionId, brokerageName, status: status as never },
      update: { providerUserId: credentials.providerUserId, brokerageName, status, lastAttemptedSyncAt: new Date() },
    });
    synced.push(await synchronizeConnection(userId, connection.id));
  }
  return synced;
}

export async function synchronizeConnection(userId: string, connectionId: string) {
  const connection = await prisma.brokerageConnection.findFirst({ where: { id: connectionId, userId, provider } });
  if (!connection?.providerConnectionId) throw new Error("Brokerage connection not found.");
  const credentials = await ensureSnapTradeUser(userId);
  const job = await prisma.syncJob.create({ data: { userId, brokerageConnectionId: connection.id, status: "RUNNING", startedAt: new Date() } });
  await prisma.brokerageConnection.update({ where: { id: connection.id }, data: { status: "INITIAL_SYNC", lastAttemptedSyncAt: new Date(), syncErrorCode: null, syncErrorMessage: null, safeErrorMessage: null } });
  try {
    const client = snaptradeClient();
    const providerConnectionId = connection.providerConnectionId;
    const accountsResponse = await client.connections.listBrokerageAuthorizationAccounts({ authorizationId: providerConnectionId, userId: credentials.providerUserId, userSecret: credentials.userSecret });
    const accounts = Array.isArray(accountsResponse.data) ? accountsResponse.data as ProviderRecord[] : [];
    let holdings = 0; let transactions = 0;
    for (const rawAccount of accounts) { const counts = await synchronizeAccount(userId, connection, credentials, rawAccount); holdings += counts.holdings; transactions += counts.transactions; }
    const completedAt = new Date();
    await prisma.$transaction([
      prisma.syncJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt, attemptedAccounts: accounts.length, synchronizedAccounts: accounts.length, synchronizedHoldings: holdings, synchronizedTransactions: transactions } }),
      prisma.brokerageConnection.update({ where: { id: connection.id }, data: { status: "ACTIVE", lastSuccessfulSyncAt: completedAt, accountsSynchronized: accounts.length, holdingsSynchronized: holdings, transactionsSynchronized: transactions } }),
    ]);
    return { connectionId: connection.id, accounts: accounts.length, holdings, transactions };
  } catch (error) {
    const providerFailure = providerError(error);
    await prisma.$transaction([
      prisma.syncJob.update({ where: { id: job.id }, data: { status: "FAILED", completedAt: new Date(), errorCode: providerFailure.code, errorMessage: providerFailure.safeMessage, diagnosticId: providerFailure.diagnosticId } }),
      prisma.brokerageConnection.update({ where: { id: connection.id }, data: { status: providerFailure.code === "401" || providerFailure.code === "403" ? "REAUTH_REQUIRED" : "FAILED", syncErrorCode: providerFailure.code, syncErrorMessage: providerFailure.safeMessage, safeErrorMessage: providerFailure.safeMessage, diagnosticId: providerFailure.diagnosticId } }),
    ]);
    throw error;
  }
}

async function synchronizeAccount(userId: string, connection: { id: string; providerConnectionId: string | null }, credentials: { providerUserId: string; userSecret: string }, raw: ProviderRecord) {
  const providerAccountId = required(raw.id, "SnapTrade account ID");
  const portfolio = await ensureConnectedPortfolio(userId);
  const account = await prisma.investmentAccount.upsert({ where: { userId_providerAccountId: { userId, providerAccountId } }, create: { userId, brokerageConnectionId: connection.id, portfolioId: portfolio.id, providerAccountId, name: stringValue(raw.name) || "Connected account", officialName: stringValue(raw.name), maskedAccountNumber: redact(stringValue(raw.number)), accountType: stringValue(raw.raw_type) || "BROKERAGE", currency: "USD", status: raw.status === "closed" ? "CLOSED" : "ACTIVE" }, update: { brokerageConnectionId: connection.id, name: stringValue(raw.name) || "Connected account", officialName: stringValue(raw.name), maskedAccountNumber: redact(stringValue(raw.number)), accountType: stringValue(raw.raw_type) || "BROKERAGE", status: raw.status === "closed" ? "CLOSED" : "ACTIVE" } });
  const client = snaptradeClient();
  const detailsResponse = await providerStep("account details", () => client.accountInformation.getUserAccountDetails({ accountId: providerAccountId, userId: credentials.providerUserId, userSecret: credentials.userSecret }));
  const positionsResponse = await providerStep("positions", () => client.accountInformation.getAllAccountPositions({ accountId: providerAccountId, userId: credentials.providerUserId, userSecret: credentials.userSecret }));
  const balancesResponse = await providerStep("balances", () => client.accountInformation.getUserAccountBalance({ accountId: providerAccountId, userId: credentials.providerUserId, userSecret: credentials.userSecret }));
  const activitiesResponse = await providerStep("transactions", () => client.accountInformation.getAccountActivities({ accountId: providerAccountId, limit: 1000, userId: credentials.providerUserId, userSecret: credentials.userSecret }));
  const details = detailsResponse.data as ProviderRecord;
  await prisma.investmentAccount.update({ where: { id: account.id }, data: { officialName: stringValue(details.name) || account.officialName, maskedAccountNumber: redact(stringValue(details.number)) || account.maskedAccountNumber } });
  const positionsData = positionsResponse.data as { results?: unknown[] };
  const normalizedPositions = (Array.isArray(positionsData.results) ? positionsData.results : []).map(normalizePosition).filter((value) => value.quantity !== "0");
  const activitiesData = activitiesResponse.data as { data?: unknown[] };
  const normalizedActivities = (Array.isArray(activitiesData.data) ? activitiesData.data : []).map(normalizeActivity);
  await prisma.$transaction(async (tx) => {
    await tx.holding.deleteMany({ where: { accountId: account.id, source: "SNAPTRADE" } });
    for (const position of normalizedPositions) {
      const security = await upsertSecurity(tx, position);
      await tx.holding.create({ data: { accountId: account.id, securityId: security.id, quantity: new Decimal(position.quantity), averageCost: position.averageCost ? new Decimal(position.averageCost) : null, currentPrice: position.currentPrice ? new Decimal(position.currentPrice) : null, marketValue: new Decimal(position.marketValue), currency: position.currency, asOfDate: new Date(), source: "SNAPTRADE" } });
    }
    await tx.cashBalance.deleteMany({ where: { accountId: account.id, source: "SNAPTRADE" } });
    for (const balance of Array.isArray(balancesResponse.data) ? balancesResponse.data as ProviderRecord[] : []) { const currency = objectValue(balance.currency); const code = stringValue(currency?.code) || "USD"; const cash = numberLike(balance.cash); if (cash) await tx.cashBalance.create({ data: { accountId: account.id, amount: new Decimal(cash), currency: code, asOfDate: new Date(), source: "SNAPTRADE" } }); }
    for (const activity of normalizedActivities) { const security = activity.security ? await upsertSecurity(tx, activity.security) : null; if (activity.providerTransactionId) await tx.investmentTransaction.upsert({ where: { accountId_providerTransactionId: { accountId: account.id, providerTransactionId: activity.providerTransactionId } }, create: { accountId: account.id, securityId: security?.id, providerTransactionId: activity.providerTransactionId, type: activity.type as never, subtype: activity.subtype, tradeDate: activity.tradeDate, settlementDate: activity.settlementDate, quantity: activity.quantity ? new Decimal(activity.quantity) : null, price: activity.price ? new Decimal(activity.price) : null, amount: new Decimal(activity.amount), fees: activity.fees ? new Decimal(activity.fees) : null, currency: activity.currency, description: activity.description, source: "SNAPTRADE" }, update: { securityId: security?.id, type: activity.type as never, subtype: activity.subtype, tradeDate: activity.tradeDate, settlementDate: activity.settlementDate, quantity: activity.quantity ? new Decimal(activity.quantity) : null, price: activity.price ? new Decimal(activity.price) : null, amount: new Decimal(activity.amount), fees: activity.fees ? new Decimal(activity.fees) : null, currency: activity.currency, description: activity.description } }); }
  });
  return { holdings: normalizedPositions.length, transactions: normalizedActivities.filter((item) => item.providerTransactionId).length };
}

async function ensureConnectedPortfolio(userId: string) { const existing = await prisma.portfolio.findFirst({ where: { userId, name: "Connected brokerages" } }); return existing ?? prisma.portfolio.create({ data: { userId, name: "Connected brokerages" } }); }
async function upsertSecurity(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], input: { providerSecurityId?: string; symbol?: string; name: string; securityType: string }) {
  const identifiers = [ ...(input.providerSecurityId ? [{ providerSecurityId: input.providerSecurityId }] : []), ...(input.symbol ? [{ canonicalSymbol: input.symbol }] : []) ];
  const existing = identifiers.length ? await tx.security.findFirst({ where: { OR: identifiers } }) : null;
  if (existing) return tx.security.update({ where: { id: existing.id }, data: { name: input.name, securityType: input.securityType as never, ...(input.providerSecurityId && !existing.providerSecurityId ? { providerSecurityId: input.providerSecurityId } : {}) } });
  return tx.security.create({ data: { providerSecurityId: input.providerSecurityId, canonicalSymbol: input.symbol, name: input.name, securityType: input.securityType as never } });
}
function stringValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function objectValue(value: unknown) { return value && typeof value === "object" ? value as ProviderRecord : undefined; }
function required(value: unknown, label: string) { const result = stringValue(value); if (!result) throw new Error(`Missing ${label} in provider response.`); return result; }
function numberLike(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value) ? value : undefined; }
function redact(value?: string) { return value ? `••••${value.slice(-4)}` : null; }
async function providerStep<T>(name: string, request: () => Promise<T>) {
  try { return await request(); }
  catch (error) {
    const status = typeof error === "object" && error && "status" in error ? String((error as { status?: unknown }).status ?? "unknown") : "unknown";
    throw new Error(`SnapTrade ${name} request failed (HTTP ${status}).`);
  }
}
