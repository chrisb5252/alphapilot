import { performancePoints } from "./mock-data";

export function PerformanceChart() {
  const width = 720;
  const height = 214;
  const padding = 10;
  const max = Math.max(...performancePoints);
  const min = Math.min(...performancePoints);
  const points = performancePoints.map((point, index) => {
    const x = padding + (index / (performancePoints.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point - min) / (max - min)) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const fillPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
  return <div className="mt-6"><svg viewBox={`0 0 ${width} ${height}`} className="h-46 w-full overflow-visible" role="img" aria-label="Portfolio value trend"><defs><linearGradient id="portfolio-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#16a34a" stopOpacity=".22"/><stop offset="1" stopColor="#16a34a" stopOpacity="0"/></linearGradient></defs><path d={`M ${padding} ${height - padding} L ${fillPoints.replace(`${padding},${height - padding} `, "").replace(` ${width - padding},${height - padding}`, "")} L ${width - padding} ${height - padding} Z`} fill="url(#portfolio-fill)"/><polyline points={points} fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wide text-slate-400"><span>6 months ago</span><span>Today</span></div></div>;
}
