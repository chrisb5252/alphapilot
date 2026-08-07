"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PaperGamePanel } from "@/components/paper-trading/paper-game-panel";

type PortfolioListItem = {
  id: string;
  name: string;
  startingCashUSD: string;
  cashUSD: string;
  totalValueUSD: string | null;
  priceCoverage: boolean;
  positionCount: number;
};
type Position = {
  ticker: string;
  shares: string;
  avgCostBasis: string;
  currentPrice: string | null;
  marketValue: string | null;
  gainLoss: string | null;
  quoteStatus: string;
  quoteRetrievedAt: string | null;
};
type Detail = {
  id: string;
  name: string;
  startingCashUSD: string;
  cashUSD: string;
  totalValueUSD: string | null;
  priceCoverage: boolean;
  positions: Position[];
  snapshots: Array<{
    timestamp: string;
    totalValueUSD: string;
    cashUSD: string;
  }>;
};
type Quote = {
  ticker: string;
  name: string;
  price: string | null;
  currency: string | null;
  status: string;
  retrievedAt: string | null;
};

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const examples = ["AAPL", "MSFT", "NVDA"];
const money = (value: string | null) =>
  value === null ? "Data unavailable" : dollars.format(Number(value));

export function PaperTradingWorkspace() {
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [startingCash, setStartingCash] = useState("100000");
  const [name, setName] = useState("My paper portfolio");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("1");
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [executionPrice, setExecutionPrice] = useState("");

  const load = useCallback(
    async (preferredId?: string) => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/paper-portfolios", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load paper portfolios.");
        setPortfolios(data.portfolios);
        const id = preferredId ?? selectedId ?? data.portfolios[0]?.id ?? null;
        setSelectedId(id);
        if (!id) {
          setDetail(null);
          return;
        }
        const detailResponse = await fetch(`/api/paper-portfolios/${id}`, {
          cache: "no-store",
        });
        const detailData = await detailResponse.json();
        if (!detailResponse.ok)
          throw new Error(
            detailData.error ?? "Unable to load paper portfolio.",
          );
        setDetail(detailData.portfolio);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load paper trading.",
        );
      } finally {
        setLoading(false);
      }
    },
    [selectedId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch updates state after the request resolves.
    void load();
  }, [load]);

  async function createPortfolio(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/paper-portfolios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, startingCashUSD: startingCash }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to create portfolio.");
      await load(data.portfolio.id);
      if (ticker.trim()) await findQuote(ticker);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create paper portfolio.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function quickStart(symbol: string) {
    setWorking(true);
    setError("");
    try {
      const quoteResponse = await fetch(
        `/api/paper-trading/quote?ticker=${encodeURIComponent(symbol)}`,
      );
      const quoteData = await quoteResponse.json();
      if (!quoteResponse.ok || !quoteData.quote.price)
        throw new Error(
          quoteData.error ?? "A current price is unavailable for this ticker.",
        );
      const created = await fetch("/api/paper-portfolios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${symbol} practice portfolio`,
          startingCashUSD: "100000",
        }),
      });
      const createdData = await created.json();
      if (!created.ok)
        throw new Error(createdData.error ?? "Unable to create portfolio.");
      const trade = await fetch(
        `/api/paper-portfolios/${createdData.portfolio.id}/trade`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ticker: symbol,
            type: "BUY",
            shares: "1",
            priceAtAction: quoteData.quote.price,
          }),
        },
      );
      const tradeData = await trade.json();
      if (!trade.ok)
        throw new Error(tradeData.error ?? "Unable to add simulated position.");
      setTicker(symbol);
      setQuote(quoteData.quote);
      setExecutionPrice(quoteData.quote.price);
      await load(createdData.portfolio.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to start simulated portfolio.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function findQuote(symbol = ticker) {
    const cleaned = symbol.trim().toUpperCase();
    if (!cleaned) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(
        `/api/paper-trading/quote?ticker=${encodeURIComponent(cleaned)}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to retrieve quote.");
      setTicker(cleaned);
      setQuote(data.quote);
      setExecutionPrice(data.quote.price ?? "");
    } catch (reason) {
      setQuote(null);
      setError(
        reason instanceof Error ? reason.message : "Unable to validate ticker.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function submitTrade(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(
        `/api/paper-portfolios/${selectedId}/trade`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ticker,
            type: tradeType,
            shares,
            priceAtAction: executionPrice,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to record simulated trade.");
      setTicker("");
      setQuote(null);
      setExecutionPrice("");
      setShares("1");
      await load(selectedId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to record simulated trade.",
      );
    } finally {
      setWorking(false);
    }
  }

  const gain = useMemo(
    () =>
      detail?.totalValueUSD
        ? Number(detail.totalValueUSD) - Number(detail.startingCashUSD)
        : null,
    [detail],
  );
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f8f6] px-5 text-sm text-slate-500">
        Loading simulated portfolio…
      </main>
    );
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 py-7 text-slate-900 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Paper trading only.</strong> Every balance, price, and trade
          here is simulated—no money moves and no real trades are placed.
        </div>
        <header className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
              Practice with live market context
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Paper trading
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Build an imaginary portfolio, test your research, and track it
              from today forward.
            </p>
          </div>
          {portfolios.length > 0 && (
            <select
              value={selectedId ?? ""}
              onChange={(event) => void load(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Choose a portfolio</option>
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </option>
              ))}
            </select>
          )}
        </header>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            {error}
          </p>
        )}
        {!detail ? (
          <FirstRun
            name={name}
            setName={setName}
            startingCash={startingCash}
            setStartingCash={setStartingCash}
            onSubmit={createPortfolio}
            working={working}
            onQuickStart={quickStart}
          />
        ) : (
          <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Simulated value"
                value={money(detail.totalValueUSD)}
              />
              <Metric
                label="Gain / loss"
                value={
                  gain === null ? "Pricing unavailable" : dollars.format(gain)
                }
                tone={
                  gain !== null && gain < 0
                    ? "text-rose-600"
                    : "text-emerald-700"
                }
              />
              <Metric label="Simulated cash" value={money(detail.cashUSD)} />
              <Metric
                label="Open positions"
                value={String(detail.positions.length)}
              />
      </section>
      <PaperGamePanel />
            {!detail.priceCoverage && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Some current prices are unavailable. AlphaPilot does not
                substitute zero for missing market data.
              </p>
            )}
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Positions</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Prices are for simulated tracking only.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    No real holdings
                  </span>
                </div>
                <PositionsTable positions={detail.positions} />
                <PerformanceChart snapshots={detail.snapshots} />
              </section>
              <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold">Add a simulated trade</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  A market quote fills the price field; you may edit it to model
                  today’s intended price.
                </p>
                <form onSubmit={submitTrade} className="mt-5 space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTradeType("BUY")}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tradeType === "BUY" ? "bg-emerald-500 text-slate-950" : "bg-slate-100 text-slate-700"}`}
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeType("SELL")}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tradeType === "SELL" ? "bg-amber-300 text-slate-950" : "bg-slate-100 text-slate-700"}`}
                    >
                      Sell
                    </button>
                  </div>
                  <label className="block text-sm">
                    Ticker
                    <input
                      value={ticker}
                      onChange={(event) => {
                        setTicker(event.target.value);
                        setQuote(null);
                      }}
                      onBlur={() => void findQuote()}
                      placeholder="AAPL"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                    />
                  </label>
                  {quote && (
                    <p className="text-xs text-slate-600">
                      {quote.name} ·{" "}
                      {quote.price
                        ? `${money(quote.price)} ${quote.status.toLowerCase()}`
                        : "Price unavailable"}
                    </p>
                  )}
                  <label className="block text-sm">
                    Shares
                    <input
                      inputMode="decimal"
                      value={shares}
                      onChange={(event) => setShares(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                    />
                  </label>
                  <label className="block text-sm">
                    Simulated execution price
                    <input
                      inputMode="decimal"
                      value={executionPrice}
                      onChange={(event) =>
                        setExecutionPrice(event.target.value)
                      }
                      placeholder="Enter today’s simulated price"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                    />
                  </label>
                  <p className="text-xs leading-5 text-slate-500">
                    Recorded exactly as entered. This does not execute or
                    recommend a real trade.
                  </p>
                  <button
                    disabled={working || !ticker || !executionPrice}
                    className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working
                      ? "Working…"
                      : `Record simulated ${tradeType.toLowerCase()}`}
                  </button>
                </form>
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <strong className="text-slate-900">Pro research</strong>
                  <br />
                  Deeper evidence-backed research and comparison tools are
                  available as AlphaPilot Pro evolves. Paper trading stays free.
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function FirstRun({
  name,
  setName,
  startingCash,
  setStartingCash,
  onSubmit,
  working,
  onQuickStart,
}: {
  name: string;
  setName: (value: string) => void;
  startingCash: string;
  setStartingCash: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  working: boolean;
  onQuickStart: (symbol: string) => void;
}) {
  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="font-mono text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
        Start in one minute
      </p>
      <h2 className="mt-3 text-2xl font-semibold">
        Practice with $100,000 in simulated cash.
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        No brokerage connection needed. Create an imaginary portfolio, then add
        a familiar company in one tap.
      </p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Portfolio name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
          />
        </label>
        <label className="text-sm">
          Starting simulated cash
          <input
            value={startingCash}
            inputMode="decimal"
            onChange={(event) => setStartingCash(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
          />
        </label>
        <button
          disabled={working}
          className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {working ? "Creating…" : "Create simulated portfolio"}
        </button>
      </form>
      <div className="mt-6 border-t border-slate-200 pt-5">
        <p className="text-sm text-slate-600">
          Or launch with $100,000 and one simulated share:
        </p>
        <div className="mt-3 flex gap-2">
          {examples.map((symbol) => (
            <button
              type="button"
              disabled={working}
              key={symbol}
              onClick={() => onQuickStart(symbol)}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-50"
            >
              Start with {symbol}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
function Metric({
  label,
  value,
  tone = "text-slate-950",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${tone}`}>
        {value}
      </p>
    </article>
  );
}
function PositionsTable({ positions }: { positions: Position[] }) {
  if (!positions.length)
    return (
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center text-sm leading-6 text-slate-600">
        No simulated positions yet. Use the trade panel to add your first one.
      </div>
    );
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="pb-3">Ticker</th>
            <th className="pb-3">Shares</th>
            <th className="pb-3">Avg. cost</th>
            <th className="pb-3">Current price</th>
            <th className="pb-3">Gain / loss</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.ticker} className="border-b border-slate-100">
              <td className="py-4 font-semibold text-slate-950">
                {position.ticker}
              </td>
              <td>{position.shares}</td>
              <td>{money(position.avgCostBasis)}</td>
              <td>{money(position.currentPrice)}</td>
              <td
                className={
                  position.gainLoss && Number(position.gainLoss) < 0
                    ? "text-rose-600"
                    : "text-emerald-700"
                }
              >
                {money(position.gainLoss)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function PerformanceChart({ snapshots }: { snapshots: Detail["snapshots"] }) {
  return (
    <div className="mt-7 border-t border-slate-200 pt-6">
      <h3 className="font-semibold">Value over time</h3>
      {snapshots.length < 2 ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Your performance history begins today and grows with daily snapshots.
          AlphaPilot does not backfill simulated performance.
        </p>
      ) : (
        <div className="mt-4 flex h-36 items-end gap-1">
          {snapshots.map((point) => (
            <div
              key={point.timestamp}
              title={`${new Date(point.timestamp).toLocaleDateString()}: ${money(point.totalValueUSD)}`}
              className="flex-1 rounded-t bg-emerald-400/70"
              style={{
                height: `${Math.max(8, (Number(point.totalValueUSD) / Math.max(...snapshots.map((value) => Number(value.totalValueUSD)))) * 100)}%`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
