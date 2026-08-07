"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
type League = {
  id: string;
  name: string;
  inviteCode: string;
  ownerUserId: string;
  _count: { members: number };
};
export function PaperLeagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/paper-game/leagues");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setLeagues(data.leagues);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- asynchronous fetch updates state after it resolves.
    void load().catch((reason) =>
      setError(
        reason instanceof Error ? reason.message : "Unable to load leagues.",
      ),
    );
  }, [load]);
  async function submit(event: FormEvent, path: string, body: object) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update league.",
      );
    }
  }
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 py-9 sm:px-8">
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
          Private simulated leagues
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Compete with friends
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Leagues use simulated paper-game scores only. No real accounts, names,
          balances, or money are shared.
        </p>
        {error && (
          <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </p>
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <form
            onSubmit={(event) =>
              void submit(event, "/api/paper-game/leagues", { name })
            }
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">Create a league</h2>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Weekend investors"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <button className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">
              Create private league
            </button>
          </form>
          <form
            onSubmit={(event) =>
              void submit(event, "/api/paper-game/leagues/join", {
                inviteCode: code,
              })
            }
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">Join with invite code</h2>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Invite code"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <button className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Join league
            </button>
          </form>
        </div>
        <div className="mt-6 space-y-3">
          {leagues.map((league) => (
            <article
              key={league.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-semibold text-slate-950">{league.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {league._count.members} members · Invite code:{" "}
                <span className="font-mono font-semibold">
                  {league.inviteCode}
                </span>
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
