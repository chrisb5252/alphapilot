"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type MarketRecord = {
  id: string;
  provider: string;
  price: string | null;
  currency: string | null;
  previousClose: string | null;
  change: string | null;
  changePercent: string | null;
  marketTimestamp: string | null;
  providerTimestamp: string | null;
  retrievedAt: string;
  dataStatus: string;
  provenance?: {
    code?: string;
    message?: string;
  } | null;
};
type SecurityData = {
  id: string;
  canonicalSymbol: string | null;
  name: string;
  securityType: string;
  exchange: string | null;
  currency: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  marketQuotes: MarketRecord[];
  marketResolutions: Array<{
    status: string;
    confidence: string;
    source: string;
    updatedAt: string;
  }>;
  enrichments: Array<{
    assetClass: string | null;
    marketCap: string | null;
    fundCategory: string | null;
    expenseRatio: string | null;
    dividendYield: string | null;
    beta: string | null;
    retrievedAt: string;
    provider: string;
  }>;
  historicalPrices: Array<{
    tradingDate: string;
    close: string | null;
    adjustedClose: string | null;
    isAdjusted: boolean;
  }>;
  corporateEvents: Array<{
    id: string;
    type: string;
    eventDate: string;
    amount: string | null;
    currency: string | null;
  }>;
  marketNews: Array<{
    id: string;
    headline: string;
    summary: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    publishedAt: string | null;
  }>;
};

function number(value: string | null | undefined) {
  const parsed =
    value === null || value === undefined ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function formatMoney(value: string | null | undefined, currency = "USD") {
  const parsed = number(value);
  if (parsed === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(parsed);
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    REAL_TIME: "Real-time",
    DELAYED: "Delayed",
    END_OF_DAY: "End of day",
    STALE: "Stale",
    UNAVAILABLE: "Data unavailable",
    UNSUPPORTED: "Unsupported asset",
    PROVIDER_FAILURE: "Provider unavailable",
    AMBIGUOUS: "Security needs review",
    UNRESOLVED: "Security unresolved",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function SecurityDetails({ securityId }: { securityId: string }) {
  const [security, setSecurity] = useState<SecurityData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/market-data/securities/${securityId}`,
        {
          cache: "no-store",
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to load security details.");
      setSecurity(body);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load security details.",
      );
    } finally {
      setLoading(false);
    }
  }, [securityId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch updates state asynchronously.
    void load();
  }, [load]);
  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(
        `/api/market-data/securities/${securityId}/refresh`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to refresh market data.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to refresh market data.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f8f6] text-slate-500">
        Loading security details…
      </main>
    );
  if (!security)
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-emerald-700"
        >
          ← Dashboard
        </Link>
        <p className="mt-8 rounded-xl bg-red-50 p-4 text-red-700">
          {error || "Security not found."}
        </p>
      </main>
    );

  const quote = security.marketQuotes[0];
  const enrichment = security.enrichments[0];
  const resolution = security.marketResolutions[0];
  const quoteCurrency = quote?.currency || security.currency || "USD";
  const change = number(quote?.change);
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Back to dashboard
        </Link>
        <header className="mt-7 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-emerald-700">
              Security details
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {security.canonicalSymbol || security.name}
            </h1>
            <p className="mt-2 text-slate-600">
              {security.name} · {security.exchange || "Exchange unavailable"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Status
              status={quote?.dataStatus || resolution?.status || "UNAVAILABLE"}
            />
            <button
              disabled={refreshing}
              onClick={() => void refresh()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              {refreshing ? "Refreshing…" : "Refresh data"}
            </button>
          </div>
        </header>
        {error && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm text-slate-500">Latest market price</p>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-4xl font-semibold tracking-tight text-slate-950">
                {formatMoney(quote?.price, quoteCurrency)}
              </p>
              {change !== null && (
                <p
                  className={
                    change >= 0
                      ? "pb-1 text-sm font-semibold text-emerald-700"
                      : "pb-1 text-sm font-semibold text-red-600"
                  }
                >
                  {change >= 0 ? "+" : ""}
                  {formatMoney(quote?.change, quoteCurrency)} (
                  {quote?.changePercent ?? "—"}%)
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {quote
                ? `${statusLabel(quote.dataStatus)} · Market date ${quote.marketTimestamp ? new Date(quote.marketTimestamp).toLocaleDateString() : "unavailable"} · Retrieved ${new Date(quote.retrievedAt).toLocaleString()}`
                : "No provider quote is stored yet. Check your market-data setup and allow the scheduled refresh to run."}
            </p>
            {quote?.dataStatus === "PROVIDER_FAILURE" &&
              quote.provenance?.message && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  FMP response: {quote.provenance.message}
                </p>
              )}
            <PriceChart prices={security.historicalPrices} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold text-slate-950">Data quality</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row
                label="Provider"
                value={
                  quote?.provider || enrichment?.provider || "Not yet available"
                }
              />
              <Row
                label="Resolution"
                value={
                  resolution
                    ? `${statusLabel(resolution.status)} (${Math.round(Number(resolution.confidence) * 100)}%)`
                    : "Pending"
                }
              />
              <Row
                label="Asset class"
                value={
                  enrichment?.assetClass ||
                  security.securityType.replaceAll("_", " ")
                }
              />
              <Row label="Country" value={security.country || "Unavailable"} />
            </dl>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Company & fund data">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Metric label="Sector" value={security.sector} />
              <Metric label="Industry" value={security.industry} />
              <Metric
                label="Market cap"
                value={formatMoney(enrichment?.marketCap)}
              />
              <Metric
                label="Dividend yield"
                value={
                  enrichment?.dividendYield
                    ? `${(Number(enrichment.dividendYield) * 100).toFixed(2)}%`
                    : null
                }
              />
              <Metric
                label="Expense ratio"
                value={
                  enrichment?.expenseRatio
                    ? `${(Number(enrichment.expenseRatio) * 100).toFixed(2)}%`
                    : null
                }
              />
              <Metric label="Beta" value={enrichment?.beta} />
              <Metric label="Fund category" value={enrichment?.fundCategory} />
              <Metric
                label="Previous close"
                value={formatMoney(quote?.previousClose, quoteCurrency)}
              />
            </div>
            <p className="mt-5 text-xs text-slate-500">
              Unavailable values are intentionally shown as “—”; AlphaPilot
              never treats missing provider data as zero.
            </p>
          </Panel>
          <Panel title="Corporate events">
            {security.corporateEvents.length ? (
              <ul className="divide-y divide-slate-100">
                {security.corporateEvents.slice(0, 6).map((event) => (
                  <li
                    key={event.id}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {event.type
                          .toLowerCase()
                          .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                      </p>
                      <p className="text-slate-500">
                        {new Date(event.eventDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-medium">
                      {event.amount
                        ? formatMoney(
                            event.amount,
                            event.currency || quoteCurrency,
                          )
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="No corporate events are available yet." />
            )}
          </Panel>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Relevant news</h2>
          {security.marketNews.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {security.marketNews.map((article) => (
                <article
                  key={article.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-xs font-medium text-slate-500">
                    {article.sourceName || "Source unavailable"}
                    {article.publishedAt
                      ? ` · ${new Date(article.publishedAt).toLocaleDateString()}`
                      : ""}
                  </p>
                  <h3 className="mt-2 font-semibold leading-5">
                    {article.sourceUrl ? (
                      <a
                        href={article.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-emerald-700 hover:underline"
                      >
                        {article.headline}
                      </a>
                    ) : (
                      article.headline
                    )}
                  </h3>
                  {article.summary && (
                    <p className="mt-2 text-sm leading-5 text-slate-600">
                      {article.summary}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <Empty text="News is not available yet. It will appear after a provider refresh when your plan supports it." />
            </div>
          )}
        </section>
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          Educational information only. AlphaPilot does not provide investment
          advice or buy/sell recommendations.
        </p>
      </div>
    </main>
  );
}

function PriceChart({ prices }: { prices: SecurityData["historicalPrices"] }) {
  const points = useMemo(
    () =>
      prices
        .slice()
        .reverse()
        .map((price) => ({
          date: new Date(price.tradingDate),
          value: number(price.adjustedClose ?? price.close),
        }))
        .filter(
          (point): point is { date: Date; value: number } =>
            point.value !== null,
        ),
    [prices],
  );
  if (points.length < 2)
    return (
      <div className="mt-8 grid h-48 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
        Historical prices are not available yet.
      </div>
    );
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = high - low || 1;
  const polyline = points
    .map(
      (point, index) =>
        `${(index / (points.length - 1)) * 100},${100 - ((point.value - low) / spread) * 86 - 7}`,
    )
    .join(" ");
  return (
    <div className="mt-7">
      <div className="mb-2 flex justify-between text-xs text-slate-500">
        <span>{formatMoney(String(low))}</span>
        <span>{formatMoney(String(high))}</span>
      </div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Adjusted daily closing price history"
        className="h-48 w-full overflow-visible"
      >
        <polyline
          fill="none"
          stroke="#059669"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
          points={polyline}
        />
      </svg>
      <p className="mt-2 text-xs text-slate-500">
        Daily adjusted closing prices where supported. Range:{" "}
        {points[0].date.toLocaleDateString()}–
        {points.at(-1)?.date.toLocaleDateString()}.
      </p>
    </div>
  );
}
function Status({ status }: { status: string }) {
  const good = ["REAL_TIME", "DELAYED", "END_OF_DAY"].includes(status);
  return (
    <span
      className={
        good
          ? "rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800"
          : "rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800"
      }
    >
      {statusLabel(status)}
    </span>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
function Metric({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
      {text}
    </p>
  );
}
