"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Game = { profile: { totalXP: number; currentLevel: number; currentStreak: number; alphaScore: string | null }; achievements: Array<{ key: string; name: string; category: string; xpReward: number; earnedAt: string }>; challenges: Array<{ id: string; title: string; description: string; cadence: string; xpReward: number; endsAt: string; status: string; progress: number }> };

export function PaperGamePanel() {
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/paper-game", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to load game progress.");
    setGame(data.game);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- asynchronous fetch updates state after it resolves.
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load game progress."));
  }, [load]);
  async function review() {
    setReviewing(true); setError("");
    try { const response = await fetch("/api/paper-game/review", { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to record review."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to record review."); }
    finally { setReviewing(false); }
  }
  if (error) return <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>;
  if (!game) return <div className="mt-6 h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
  const daily = game.challenges.find((challenge) => challenge.cadence === "DAILY");
  return <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_.75fr]"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="font-mono text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">Your paper-game progress</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="AlphaScore" value={game.profile.alphaScore ? Number(game.profile.alphaScore).toFixed(0) : "—"} /><Metric label="Level" value={String(game.profile.currentLevel)} /><Metric label="XP" value={String(game.profile.totalXP)} /><Metric label="Streak" value={`${game.profile.currentStreak} days`} /></div><div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-emerald-700"><Link href="/paper-trading/leaderboard">Leaderboard</Link><Link href="/paper-trading/leagues">Leagues</Link><Link href="/paper-trading/competitions">Competitions</Link></div><p className="mt-4 text-xs leading-5 text-slate-500">AlphaScore is a versioned simulated-learning metric. It does not predict real-world investment results.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold">Daily learning challenge</p>{daily ? <><p className="mt-2 text-sm font-medium text-slate-900">{daily.title} · +{daily.xpReward} XP</p><p className="mt-1 text-sm leading-6 text-slate-600">{daily.description}</p><button onClick={() => void review()} disabled={reviewing || daily.status === "COMPLETED"} className="mt-4 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{daily.status === "COMPLETED" ? "Completed today" : reviewing ? "Recording…" : "Complete portfolio check-in"}</button></> : <p className="mt-2 text-sm text-slate-600">Today’s challenge is loading.</p>}</article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"><div className="flex items-center justify-between"><h2 className="font-semibold">Achievements</h2><span className="text-sm text-slate-500">{game.achievements.length} unlocked</span></div>{game.achievements.length ? <div className="mt-4 flex flex-wrap gap-2">{game.achievements.map((achievement) => <span key={achievement.key} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">{achievement.name} · +{achievement.xpReward} XP</span>)}</div> : <p className="mt-3 text-sm text-slate-600">Create a simulated portfolio to unlock your first achievement.</p>}</article></section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div>; }
