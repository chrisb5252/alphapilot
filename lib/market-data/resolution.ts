import type {
  ResolutionResult,
  SecurityCandidate,
  SecurityLookup,
} from "@/lib/market-data/types";

export function chooseResolutionCandidate(
  lookup: SecurityLookup,
  candidates: SecurityCandidate[],
): ResolutionResult {
  if (!candidates.length)
    return {
      status: "UNRESOLVED",
      source: "provider_search",
      message: "No provider match was found.",
    };
  const symbol = lookup.symbol?.trim().toUpperCase();
  const exactSymbols = symbol
    ? candidates.filter(
        (candidate) => candidate.symbol?.toUpperCase() === symbol,
      )
    : [];
  const matching = exactSymbols.length
    ? exactSymbols
    : candidates.filter((candidate) => candidate.confidence >= 0.95);
  if (matching.length !== 1)
    return {
      status: "AMBIGUOUS",
      source: "provider_search",
      candidates,
      message:
        "Multiple possible securities matched. Review the exchange and identifier before resolving.",
    };
  const candidate = matching[0];
  if (
    lookup.exchange &&
    candidate.exchange &&
    !candidate.exchange.toLowerCase().includes(lookup.exchange.toLowerCase())
  )
    return {
      status: "AMBIGUOUS",
      source: "provider_search",
      candidates,
      message: "The provider match does not confirm the imported exchange.",
    };
  return { status: "RESOLVED", source: "provider_search", candidate };
}
