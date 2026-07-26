type SummaryCardProps = {
  label: string;
  value: string;
  description: string;
  tone?: "default" | "positive" | "negative";
};

export function SummaryCard({ label, value, description, tone = "default" }: SummaryCardProps) {
  const toneClass = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-slate-500";
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_3px_rgba(15,23,42,0.02)]"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p><p className={`mt-2 text-sm ${toneClass}`}>{description}</p></article>;
}
