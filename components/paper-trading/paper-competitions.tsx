"use client";
import { useEffect, useState } from "react";
type Competition = {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  startingCashUSD: string;
  scoringMethod: string;
  status: string;
  entered: boolean;
};
type Portfolio = { id: string; name: string; startingCashUSD: string };
export function PaperCompetitions() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/paper-game/competitions")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setCompetitions(data.competitions);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load competitions.",
        ),
      );
    void fetch("/api/paper-portfolios")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setPortfolios(data.portfolios);
        setSelectedPortfolioId(
          data.portfolios.find(
            (portfolio: Portfolio) =>
              Number(portfolio.startingCashUSD) === 100000,
          )?.id ??
            data.portfolios[0]?.id ??
            "",
        );
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load portfolios.",
        ),
      );
  }, []);
  async function enter(competitionId: string) {
    if (!selectedPortfolioId) return;
    setError("");
    const response = await fetch(
      `/api/paper-game/competitions/${competitionId}/enter`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperPortfolioId: selectedPortfolioId }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Unable to enter competition.");
      return;
    }
    setCompetitions((items) =>
      items.map((item) =>
        item.id === competitionId ? { ...item, entered: true } : item,
      ),
    );
  }
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 py-9 sm:px-8">
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">
          Free simulated competitions
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Paper-game seasons
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Free to enter, no cash prizes, no wagering, and no real orders.
          Rankings use the declared simulated scoring method.
        </p>
        {error ? (
          <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {competitions.map((competition) => (
              <article
                key={competition.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {competition.name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {competition.description}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {competition.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                  <span>
                    Virtual start: $
                    {Number(competition.startingCashUSD).toLocaleString()}
                  </span>
                  <span>
                    Starts:{" "}
                    {new Date(competition.startsAt).toLocaleDateString()}
                  </span>
                  <span>
                    Scoring: {competition.scoringMethod.replaceAll("_", " ")}
                  </span>
                </div>
                {competition.entered ? (
                  <p className="mt-4 text-sm font-semibold text-emerald-700">
                    Entered with your simulated portfolio.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <select
                      value={selectedPortfolioId}
                      onChange={(event) =>
                        setSelectedPortfolioId(event.target.value)
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {portfolios.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!selectedPortfolioId}
                      onClick={() => void enter(competition.id)}
                      className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                      Enter free competition
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!competitions.length && (
              <p className="rounded-xl bg-white p-5 text-sm text-slate-600">
                No public competitions are open yet.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
