import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { configuredMarketDataProvider } from "@/lib/market-data/provider-registry";
import { chooseResolutionCandidate } from "@/lib/market-data/resolution";
import { reserveProviderRequest } from "@/lib/market-data/budget";
import type { ResolutionResult, SecurityLookup } from "@/lib/market-data/types";

export async function resolveCanonicalSecurity(
  securityId: string,
): Promise<ResolutionResult> {
  const security = await prisma.security.findUnique({
    where: { id: securityId },
  });
  if (!security) throw new Error("Security not found.");
  const provider = configuredMarketDataProvider();
  if (!provider)
    return persist(securityId, "ALPHA_VANTAGE", {
      status: "UNRESOLVED",
      source: "provider_disabled",
      message: "Market data is not configured.",
    });

  const lookup: SecurityLookup = {
    securityId,
    providerSecurityId: security.providerSecurityId,
    symbol: security.canonicalSymbol,
    exchange: security.exchange,
    cusip: security.cusip,
    isin: security.isin,
    name: security.name,
    securityType: security.securityType,
    currency: security.currency,
  };
  const existing = await prisma.marketSecurityResolution.findUnique({
    where: { securityId_provider: { securityId, provider: provider.id } },
  });
  if (existing?.status === "RESOLVED" && existing.providerSymbol)
    return {
      status: "RESOLVED",
      source: "cached_provider_resolution",
      candidate: {
        providerSecurityId: existing.providerSecurityId ?? undefined,
        symbol: existing.providerSymbol,
        name: security.name,
        confidence: Number(existing.confidence),
        evidence: (existing.evidence as Record<string, unknown>) ?? {},
      },
    };
  if (!lookup.symbol && !lookup.name)
    return persist(securityId, provider.id, {
      status: "UNSUPPORTED",
      source: "missing_identifier",
      message: "This security has no supported market-data identifier.",
    });

  await reserveProviderRequest(provider.id);
  const result = await provider.resolveSecurity(lookup);
  if (!result.ok)
    return persist(securityId, provider.id, {
      status: result.status === "UNSUPPORTED" ? "UNSUPPORTED" : "UNRESOLVED",
      source: "provider_search",
      message: result.message,
    });
  return persist(
    securityId,
    provider.id,
    chooseResolutionCandidate(lookup, result.value),
  );
}

async function persist(
  securityId: string,
  provider: "ALPHA_VANTAGE",
  result: ResolutionResult,
): Promise<ResolutionResult> {
  const candidate = result.candidate;
  await prisma.marketSecurityResolution.upsert({
    where: { securityId_provider: { securityId, provider } },
    create: {
      securityId,
      provider,
      providerSecurityId: candidate?.providerSecurityId ?? null,
      providerSymbol: candidate?.symbol ?? null,
      confidence: String(candidate?.confidence ?? 0),
      status: result.status,
      source: result.source,
      evidence: json(
        candidate?.evidence ?? {
          candidates: result.candidates ?? [],
          message: result.message ?? null,
        },
      ),
    },
    update: {
      providerSecurityId: candidate?.providerSecurityId ?? null,
      providerSymbol: candidate?.symbol ?? null,
      confidence: String(candidate?.confidence ?? 0),
      status: result.status,
      source: result.source,
      evidence: json(
        candidate?.evidence ?? {
          candidates: result.candidates ?? [],
          message: result.message ?? null,
        },
      ),
      retrievedAt: new Date(),
    },
  });
  return result;
}

function json(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined
    ? Prisma.JsonNull
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}
