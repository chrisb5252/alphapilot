import { allocation } from "./mock-data";
import { percent } from "./formatters";

export function AllocationCard() {
  let position = 0;
  const segments = allocation.map((item) => { const start = position; position += item.value; return `${item.color} ${start}% ${position}%`; }).join(", ");
  return <article id="allocation" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_3px_rgba(15,23,42,0.02)] sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Allocation</h2><p className="mt-1 text-sm text-slate-500">Your sector exposure</p></div><button className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Details</button></div><div className="mt-7 flex flex-col items-center gap-7 sm:flex-row"><div className="grid size-42 shrink-0 place-items-center rounded-full" style={{ backgroundImage: `conic-gradient(${segments})` }}><div className="grid size-29 place-items-center rounded-full bg-white text-center"><strong className="text-2xl tracking-tight">{allocation.length}</strong><span className="mt-[-5px] text-[11px] text-slate-500">sectors</span></div></div><div className="w-full space-y-3">{allocation.map((item) => <div className="flex items-center gap-3 text-sm" key={item.label}><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }}/><span className="flex-1 text-slate-600">{item.label}</span><strong className="font-semibold text-slate-900">{percent(item.value)}</strong></div>)}</div></div></article>;
}
