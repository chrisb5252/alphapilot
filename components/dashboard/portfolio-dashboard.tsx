"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PortfolioImportDialog } from "@/components/import/portfolio-import-dialog";

type Dashboard = {
  portfolio: {
    id: string;
    name: string;
    totalValue: number;
    totalCost: number;
    totalGain: number;
    totalGainPercent: number | null;
    diversificationScore: number;
    holdingCount: number;
    importedAt: string;
  };
  holdings: Array<{
    id: string;
    securityId: string;
    symbol: string;
    companyName: string | null;
    sector: string | null;
    shares: number;
    marketValue: number;
    allocationPercent: number;
    marketData: {
      status: string;
      price: number | null;
      currency: string | null;
      retrievedAt: string | null;
      marketTimestamp: string | null;
      provider: string | null;
    };
  }>;
  allocation: Array<{ label: string; value: number; percentage: number }>;
  analytics: {
    diversificationScore: number;
    concentration: {
      topHoldingPercent: number | null;
      topThreePercent: number | null;
      largestSectorPercent: number | null;
    };
    assetAllocation: Array<{
      label: string;
      value: number;
      percentage: number;
    }>;
    dataQuality: {
      costBasisCoveragePercent: number;
      classifiedValuePercent: number;
      message: string;
    };
    insights: Array<{
      id: string;
      severity: "INFO" | "LOW" | "MEDIUM" | "HIGH";
      title: string;
      summary: string;
    }>;
    researchAreas: string[];
  };
};
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
export function PortfolioDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolios/dashboard", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDashboard(json.dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load portfolio.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load updates state asynchronously after the request.
    void load();
  }, [load]);
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f8f6] text-slate-500">
        Loading your portfolio…
      </main>
    );
  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-emerald-700">
              AlphaPilot
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Portfolio dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Clear portfolio context and education—not investment advice.
            </p>
          </div>
          <PortfolioImportDialog
            onComplete={load}
            portfolioId={dashboard?.portfolio.id}
          />
        </header>
        {error && (
          <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {!dashboard ? (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">
              Your portfolio starts here
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              Upload a CSV exported from Robinhood, Fidelity, Schwab, Vanguard,
              E*TRADE, Webull, or your own spreadsheet. You’ll be able to review
              every row before anything is saved.
            </p>
          </section>
        ) : (
          <LiveDashboard dashboard={dashboard} />
        )}
      </main>
    </div>
  );
}
function LiveDashboard({ dashboard }: { dashboard: Dashboard }) {
  const { portfolio, holdings, allocation, analytics } = dashboard;
  const gain = portfolio.totalGain >= 0;
  return (
    <>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Portfolio value"
          value={money.format(portfolio.totalValue)}
          detail={`${portfolio.holdingCount} imported holdings`}
        />
        <Card
          label="Unrealized gain / loss"
          value={`${gain ? "+" : ""}${money.format(portfolio.totalGain)}`}
          detail={
            portfolio.totalGainPercent === null
              ? "Cost data unavailable"
              : `${gain ? "+" : ""}${portfolio.totalGainPercent.toFixed(1)}% from cost basis`
          }
          positive={gain}
        />
        <Card
          label="Diversification"
          value={`${portfolio.diversificationScore}/100`}
          detail="Based on holdings and sector concentration"
        />
        <Card
          label="Total invested"
          value={money.format(portfolio.totalCost)}
          detail={`Imported ${new Date(portfolio.importedAt).toLocaleDateString()}`}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Holdings</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-3">Holding</th>
                  <th className="pb-3">Sector</th>
                  <th className="pb-3 text-right">Shares</th>
                  <th className="pb-3 text-right">Value</th>
                  <th className="pb-3 text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {holdings
                  .sort((a, b) => b.marketValue - a.marketValue)
                  .map((holding) => (
                    <tr className="border-b last:border-0" key={holding.id}>
                      <td className="py-3">
                        <Link
                          href={`/securities/${holding.securityId}`}
                          className="font-semibold text-slate-950 underline-offset-4 hover:text-emerald-700 hover:underline"
                        >
                          {holding.symbol}
                        </Link>
                        <span className="ml-2 text-slate-500">
                          {holding.companyName}
                        </span>
                        {holding.marketData.status !== "DELAYED" &&
                          holding.marketData.status !== "END_OF_DAY" &&
                          holding.marketData.status !== "REAL_TIME" && (
                            <p className="mt-1 text-xs text-amber-700">
                              Market data:{" "}
                              {marketDataLabel(holding.marketData.status)}
                            </p>
                          )}
                      </td>
                      <td className="py-3 text-slate-500">
                        {holding.sector || "Unclassified"}
                      </td>
                      <td className="py-3 text-right">{holding.shares}</td>
                      <td className="py-3 text-right font-medium">
                        {money.format(holding.marketValue)}
                      </td>
                      <td className="py-3 text-right">
                        {holding.allocationPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Sector exposure</h2>
          <div className="mt-5 space-y-4">
            {allocation.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <strong>{item.percentage.toFixed(1)}%</strong>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl bg-slate-950 p-4 text-sm text-white">
            <strong>Risk indicator</strong>
            <p className="mt-1 text-slate-300">
              Largest holding:{" "}
              {holdings.reduce(
                (top, x) => (x.marketValue > top.marketValue ? x : top),
                holdings[0],
              )?.symbol ?? "—"}
              . Concentration and sector exposure are educational signals, not
              recommendations.
            </p>
          </div>
        </section>
      </div>
      <section className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Portfolio insights</h2>
              <p className="mt-1 text-sm text-slate-500">
                Educational composition signals from your imported holdings.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Imported data only
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {analytics.insights.map((insight) => (
              <article
                key={insight.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">
                    {insight.title}
                  </h3>
                  <Severity severity={insight.severity} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {insight.summary}
                </p>
              </article>
            ))}
          </div>
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Areas to research</h2>
          {analytics.researchAreas.length ? (
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {analytics.researchAreas.map((area) => (
                <li key={area} className="flex gap-2">
                  <span className="text-emerald-600">•</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Import more classification or cost-basis data to generate targeted
              research questions.
            </p>
          )}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold">Asset mix</h3>
            <div className="mt-3 space-y-2 text-sm">
              {analytics.assetAllocation.map((item) => (
                <div key={item.label} className="flex justify-between gap-3">
                  <span className="text-slate-600">{item.label}</span>
                  <strong>{item.percentage.toFixed(1)}%</strong>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Analysis coverage</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <p className="rounded-xl bg-slate-50 p-3 text-slate-600">
            Sector classification:{" "}
            <strong>
              {analytics.dataQuality.classifiedValuePercent.toFixed(1)}%
            </strong>{" "}
            of imported value
          </p>
          <p className="rounded-xl bg-slate-50 p-3 text-slate-600">
            Cost-basis coverage:{" "}
            <strong>
              {analytics.dataQuality.costBasisCoveragePercent.toFixed(1)}%
            </strong>{" "}
            of imported value
          </p>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {analytics.dataQuality.message}
        </p>
      </section>
    </>
  );
}
function Severity({
  severity,
}: {
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH";
}) {
  const className = {
    INFO: "bg-slate-100 text-slate-700",
    LOW: "bg-blue-50 text-blue-700",
    MEDIUM: "bg-amber-50 text-amber-800",
    HIGH: "bg-red-50 text-red-700",
  }[severity];
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${className}`}
    >
      {severity.toLowerCase()}
    </span>
  );
}
function marketDataLabel(status: string) {
  const labels: Record<string, string> = {
    STALE: "stale",
    UNAVAILABLE: "unavailable",
    UNSUPPORTED: "unsupported asset",
    PROVIDER_FAILURE: "provider unavailable",
  };
  return labels[status] ?? "unresolved security";
}
function Card({
  label,
  value,
  detail,
  positive,
}: {
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight ${positive === false ? "text-red-600" : "text-slate-950"}`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </section>
  );
}
