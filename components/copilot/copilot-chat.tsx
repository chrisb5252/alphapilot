"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CopilotMessage, CopilotResponse } from "@/lib/copilot/types";

const STORAGE_KEY = "alphapilot-copilot-history-v1";
const initialMessage: CopilotMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "I’m Alpha, your educational investment copilot. Ask about your holdings, risk exposure, diversification, or investment concepts.",
  createdAt: new Date(0).toISOString(),
};
const starterQuestions = [
  "What sectors am I exposed to?",
  "How diversified is this portfolio?",
  "Explain my largest holdings",
];

function makeAssistantMessage(response: CopilotResponse): CopilotMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: response.answer,
    createdAt: new Date().toISOString(),
    details: response,
  };
}

export function CopilotChat() {
  const [messages, setMessages] = useState<CopilotMessage[]>([initialMessage]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHasLoadedHistory(true);
  }, []);
  useEffect(() => {
    if (hasLoadedHistory)
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-20)),
      );
  }, [messages, hasLoadedHistory]);
  const suggestedQuestions = useMemo(
    () =>
      messages.findLast((message) => message.details)?.details
        ?.suggestedQuestions ?? starterQuestions,
    [messages],
  );

  async function sendQuestion(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const prompt = (suggested ?? question).trim();
    if (!prompt || isSending) return;
    const userMessage: CopilotMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQuestion("");
    setIsSending(true);
    try {
      const result = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      setMessages((current) => [
        ...current,
        makeAssistantMessage(payload.response),
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I couldn’t complete that response. Please try again in a moment.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex min-h-150 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_3px_rgba(15,23,42,0.02)]">
      <header className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-500 text-lg text-white">
            ✦
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Ask Alpha</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Your educational investment copilot
            </p>
          </div>
        </div>
        <button
          onClick={() => setMessages([initialMessage])}
          className="text-xs font-semibold text-slate-400 hover:text-slate-700"
        >
          Clear chat
        </button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[86%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-3 text-sm leading-6 text-white"
                : "max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
            }
          >
            {message.content}
            {message.details && (
              <>
                <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-xs text-slate-600">
                  {message.details.highlights.map((highlight) => (
                    <li key={highlight}>• {highlight}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs italic leading-5 text-slate-400">
                  {message.details.caveat}
                </p>
              </>
            )}
          </article>
        ))}
        {isSending && (
          <div className="w-fit rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <span className="inline-flex gap-1">
              <i className="size-1.5 animate-bounce rounded-full bg-emerald-500" />
              <i className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" />
              <i className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" />
            </span>
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {suggestedQuestions.map((item) => (
            <button
              onClick={() => sendQuestion(undefined, item)}
              key={item}
              className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {item}
            </button>
          ))}
        </div>
        <form onSubmit={sendQuestion} className="flex gap-2">
          <label className="sr-only" htmlFor="copilot-question">
            Ask a portfolio question
          </label>
          <input
            id="copilot-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={1500}
            placeholder="Ask about your portfolio…"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-3 focus:ring-emerald-100"
          />
          <button
            disabled={!question.trim() || isSending}
            className="rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200"
          >
            Send
          </button>
        </form>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Education only. Not financial, investment, or tax advice.
        </p>
      </div>
    </section>
  );
}
