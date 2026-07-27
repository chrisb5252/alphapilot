"use client";
import { useEffect, useState } from "react";
import { SignInButton } from "@clerk/nextjs";

type Account = {
  id: string;
  name: string;
  localName: string | null;
  maskedAccountNumber: string | null;
  isIncludedInAnalysis: boolean;
};
type Connection = {
  id: string;
  brokerageName: string;
  status: string;
  lastSuccessfulSyncAt: string | null;
  safeErrorMessage: string | null;
  accountsSynchronized: number;
  holdingsSynchronized: number;
  accounts: Account[];
};
type Brokerage = {
  slug?: string;
  display_name?: string;
  name?: string;
  enabled?: boolean;
  maintenance_mode?: boolean;
};

export function BrokerageSettings() {
  const [data, setData] = useState<{
    configured: boolean;
    testEnvironment: boolean;
    connections: Connection[];
    brokerages: Brokerage[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function load() {
    const response = await fetch("/api/brokerages/snaptrade");
    const result = await response.json();
    if (!response.ok) {
      setLoadError(result.error || "Unable to load brokerage connections.");
      return;
    }
    setLoadError(null);
    setData(result);
  }
  useEffect(() => {
    const controller = new AbortController();
    const returnedFromPortal =
      new URLSearchParams(window.location.search).get("connected") ===
      "snaptrade";
    void fetch("/api/brokerages/snaptrade", { signal: controller.signal })
      .then(async (response) => ({
        ok: response.ok,
        result: await response.json(),
      }))
      .then(async ({ ok, result }) => {
        if (controller.signal.aborted) return;
        if (!ok) {
          setLoadError(result.error || "Sign in to manage brokerages.");
          return;
        }
        setData(result);
        if (!returnedFromPortal) return;
        const sync = await fetch("/api/brokerages/snaptrade", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "sync" }),
          signal: controller.signal,
        });
        const synced = await sync.json();
        if (!sync.ok) {
          setMessage(
            synced.error ||
              "Your brokerage was connected, but its first data sync needs another try.",
          );
          return;
        }
        const refreshed = await fetch("/api/brokerages/snaptrade", {
          signal: controller.signal,
        });
        if (refreshed.ok && !controller.signal.aborted)
          setData(await refreshed.json());
        window.history.replaceState({}, "", window.location.pathname);
        setMessage("Brokerage connected and initial data synchronized.");
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  async function action(body: Record<string, unknown>, id?: string) {
    setBusy(id ?? "connect");
    setMessage("");
    try {
      const response = await fetch(
        id ? `/api/brokerages/snaptrade/${id}` : "/api/brokerages/snaptrade",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed.");
      if (result.portalUrl) window.location.assign(result.portalUrl);
      setMessage(result.message || "Request accepted.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to continue.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function updateAccount(
    id: string,
    value: Pick<Account, "isIncludedInAnalysis">,
  ) {
    const busyKey = `account:${id}`;
    setBusy(busyKey);
    setMessage("");
    try {
      const response = await fetch(`/api/brokerage-accounts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to update this account.");

      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          connections: current.connections.map((connection) => ({
            ...connection,
            accounts: connection.accounts.map((account) =>
              account.id === id
                ? {
                    ...account,
                    isIncludedInAnalysis: value.isIncludedInAnalysis,
                  }
                : account,
            ),
          })),
        };
      });
      setMessage(
        value.isIncludedInAnalysis
          ? "Account included in analysis."
          : "Account excluded from analysis.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update this account.",
      );
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function disconnect(id: string) {
    if (
      window.prompt(
        "Type DISCONNECT to remove this connected brokerage and its locally synchronized data.",
      ) !== "DISCONNECT"
    )
      return;
    setBusy(id);
    const response = await fetch(`/api/brokerages/snaptrade/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "DISCONNECT" }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? "Brokerage disconnected."
        : result.error || "Unable to disconnect.",
    );
    setBusy(null);
    await load();
  }
  if (loadError)
    return (
      <main className="mx-auto max-w-2xl p-6 sm:p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-bold">Sign in to manage brokerages</h1>
          <p className="mt-2 text-slate-600">
            Your connected accounts and investment data are private to your
            AlphaPilot account.
          </p>
          <SignInButton>
            <button className="mt-5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              Log in or create an account
            </button>
          </SignInButton>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="mx-auto max-w-5xl p-6">
        Loading brokerage connections…
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 sm:p-10">
      <section>
        <p className="text-sm font-semibold text-emerald-700">Settings</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Connected brokerages
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Connect read-only accounts to analyze your investments. AlphaPilot
          cannot place trades.
        </p>
      </section>
      {!data.configured ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          SnapTrade is not configured for this environment yet. Add the
          server-side SnapTrade variables before connecting a brokerage.
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {data.testEnvironment && (
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-950">
                Test the full connection flow
              </p>
              <p className="mt-1 text-sm text-blue-900">
                SnapTrade Sandbox uses simulated accounts, holdings, and
                transactions—no real brokerage login required.
              </p>
              <button
                disabled={busy !== null}
                onClick={() =>
                  void action({ action: "connect", broker: "SANDBOX" })
                }
                className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Connect SnapTrade Sandbox
              </button>
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Choose a brokerage
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.brokerages
              .filter((brokerage) => brokerage.enabled !== false)
              .slice(0, 24)
              .map((brokerage) => (
                <button
                  key={brokerage.slug}
                  disabled={
                    busy !== null || brokerage.maintenance_mode === true
                  }
                  onClick={() =>
                    void action({ action: "connect", broker: brokerage.slug })
                  }
                  title={
                    brokerage.maintenance_mode
                      ? "SnapTrade reports this brokerage is temporarily unavailable."
                      : undefined
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {brokerage.display_name || brokerage.name || brokerage.slug}
                  {brokerage.maintenance_mode
                    ? " (temporarily unavailable)"
                    : ""}
                </button>
              ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              disabled={busy !== null}
              onClick={() => void action({ action: "connect" })}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {busy === "connect"
                ? "Opening secure portal…"
                : "Connect a brokerage"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => void action({ action: "sync" })}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Find connected accounts
            </button>
          </div>
        </section>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700"
        >
          {message}
        </p>
      )}
      <section className="space-y-4">
        {data.connections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
            No brokerages connected yet.
          </div>
        ) : (
          data.connections.map((connection) => (
            <article
              key={connection.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-950">
                    {connection.brokerageName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {connection.status.replaceAll("_", " ")} ·{" "}
                    {connection.holdingsSynchronized} holdings
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Last updated:{" "}
                    {connection.lastSuccessfulSyncAt
                      ? new Date(
                          connection.lastSuccessfulSyncAt,
                        ).toLocaleString()
                      : "Waiting for the first sync"}
                  </p>
                  {connection.safeErrorMessage && (
                    <p className="mt-2 text-sm text-amber-700">
                      {connection.safeErrorMessage}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busy === connection.id}
                    onClick={() =>
                      void action({ action: "refresh" }, connection.id)
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                  >
                    Refresh
                  </button>
                  <button
                    disabled={busy === connection.id}
                    onClick={() =>
                      void action({ action: "repair" }, connection.id)
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                  >
                    Repair
                  </button>
                  <button
                    disabled={busy === connection.id}
                    onClick={() => void disconnect(connection.id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
              <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
                {connection.accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {account.localName || account.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {account.maskedAccountNumber ||
                          "Account number unavailable"}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={account.isIncludedInAnalysis}
                        disabled={busy === `account:${account.id}`}
                        onChange={(event) =>
                          void updateAccount(account.id, {
                            isIncludedInAnalysis: event.target.checked,
                          })
                        }
                      />{" "}
                      Include in analysis
                    </label>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
