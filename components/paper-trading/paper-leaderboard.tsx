"use client";
import { useEffect, useState } from "react";
type Row = {
  rank: number;
  nickname: string;
  alphaScore: string;
  challengePoints: number;
  level: number;
  isCurrentUser: boolean;
};
export function PaperLeaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/paper-game/leaderboard")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRows(data.rows);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load leaderboard.",
        ),
      );
  }, []);
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 py-9 sm:px-8">
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
          Simulated performance only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          AlphaScore leaderboard
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ranks use AlphaScore, not raw return alone. Nicknames protect
          identity; no real portfolios appear here.
        </p>
        {error ? (
          <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-4">Rank</th>
                  <th className="p-4">Player</th>
                  <th className="p-4">AlphaScore</th>
                  <th className="p-4">Level</th>
                  <th className="p-4">Challenge points</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr
                      key={`${row.rank}-${row.nickname}`}
                      className={
                        row.isCurrentUser
                          ? "bg-emerald-50 font-semibold"
                          : "border-t border-slate-100"
                      }
                    >
                      <td className="p-4">#{row.rank}</td>
                      <td className="p-4">{row.nickname}</td>
                      <td className="p-4">
                        {Number(row.alphaScore).toFixed(0)}
                      </td>
                      <td className="p-4">{row.level}</td>
                      <td className="p-4">{row.challengePoints}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Complete a simulated portfolio activity to appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
