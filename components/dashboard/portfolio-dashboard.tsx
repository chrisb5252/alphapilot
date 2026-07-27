"use client";
import { useCallback, useEffect, useState } from "react";
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
    symbol: string;
    companyName: string | null;
    sector: string | null;
    shares: number;
    marketValue: number;
    allocationPercent: number;
  }>;
  allocation: Array<{ label: string; value: number; percentage: number }>;
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
  const { portfolio, holdings, allocation } = dashboard;
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
                        <strong>{holding.symbol}</strong>
                        <span className="ml-2 text-slate-500">
                          {holding.companyName}
                        </span>
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
    </>
  );
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
