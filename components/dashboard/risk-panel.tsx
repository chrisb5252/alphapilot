import { riskSignals } from "./mock-data";

const styles = { low: "bg-emerald-50 text-emerald-700 ring-emerald-100", medium: "bg-amber-50 text-amber-700 ring-amber-100", high: "bg-rose-50 text-rose-700 ring-rose-100" };

export function RiskPanel() {
  return <section id="risk" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_3px_rgba(15,23,42,0.02)] sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Risk indicators</h2><p className="mt-1 text-sm text-slate-500">Educational signals to explore</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Moderate</span></div><div className="mt-5 space-y-3">{riskSignals.map((signal) => <article className="flex gap-3 rounded-xl border border-slate-100 p-3.5" key={signal.title}><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-1 ${styles[signal.level]}`}>{signal.level === "low" ? "✓" : "!"}</span><div><h3 className="text-sm font-semibold text-slate-900">{signal.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{signal.detail}</p></div></article>)}</div><p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">For education only. AlphaPilot does not provide financial, tax, or investment advice.</p></section>;
}
