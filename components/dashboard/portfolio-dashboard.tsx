"use client";

import { AllocationCard } from "./allocation-card";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { DashboardHeader } from "./dashboard-header";
import { compactMoney, money, percent } from "./formatters";
import { portfolio } from "./mock-data";
import { PerformanceChart } from "./performance-chart";
import { HoldingsTable } from "./holdings-table";
import { RiskPanel } from "./risk-panel";
import { SummaryCard } from "./summary-card";

export function PortfolioDashboard() {
  const todayTone = portfolio.dailyChange >= 0 ? "positive" : "negative";
  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <DashboardHeader />
      <main className="mx-auto max-w-360 px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[.16em] text-emerald-700">
              Portfolio dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Good morning, {portfolio.ownerName}.
            </h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              A clear view of your investments, exposure, and portfolio health.
            </p>
          </div>
          <button className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
            Upload portfolio{" "}
            <span className="ml-2 text-lg leading-none">↑</span>
          </button>
        </div>
        <div className="mt-7 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs leading-5 text-emerald-900">
          <strong>Educational analysis only.</strong> AlphaPilot offers
          portfolio context and explanations—not recommendations to buy or sell.
        </div>
        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Portfolio value"
            value={money.format(portfolio.totalValue)}
            description={`${portfolio.dailyChange >= 0 ? "+" : ""}${money.format(portfolio.dailyChange)} today`}
            tone={todayTone}
          />
          <SummaryCard
            label="All-time return"
            value={`${portfolio.totalGain >= 0 ? "+" : ""}${compactMoney.format(portfolio.totalGain)}`}
            description={`${portfolio.totalGain >= 0 ? "+" : ""}${percent(portfolio.totalGainPercent)} since inception`}
            tone="positive"
          />
          <SummaryCard
            label="Diversification"
            value={`${portfolio.diversificationScore}/100`}
            description="Moderately diversified"
          />
          <SummaryCard
            label="Total invested"
            value={money.format(portfolio.invested)}
            description="6 positions across 4 sectors"
          />
        </section>
        <section className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_3px_rgba(15,23,42,0.02)] sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Portfolio performance
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Portfolio value over the last 6 months
                </p>
              </div>
              <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                6M ▾
              </button>
            </div>
            <div className="mt-5 flex items-end gap-3">
              <strong className="text-3xl tracking-tight text-slate-950">
                {money.format(portfolio.totalValue)}
              </strong>
              <span className="mb-1 text-sm font-semibold text-emerald-600">
                +{percent(portfolio.totalGainPercent)}
              </span>
            </div>
            <PerformanceChart />
          </article>
          <AllocationCard />
        </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <HoldingsTable />
        <RiskPanel />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.45fr]">
        <article className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_2px_3px_rgba(15,23,42,0.08)] sm:p-7">
          <span className="grid size-11 place-items-center rounded-xl bg-emerald-500 text-xl">✦</span>
          <p className="mt-7 font-mono text-[11px] uppercase tracking-[.16em] text-emerald-300">AI investment copilot</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Turn numbers into understanding.</h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Ask Alpha to explain holdings, portfolio concentration, sector exposure, and educational risk signals.</p>
          <ul className="mt-7 space-y-3 text-sm text-slate-300"><li>• Portfolio-aware answers</li><li>• Clear, structured takeaways</li><li>• No buy or sell recommendations</li></ul>
        </article>
        <CopilotChat />
      </section>
      </main>
    </div>
  );
}
