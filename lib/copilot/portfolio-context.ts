import type { CopilotResponse } from "./types";

/**
 * AI portfolio context is intentionally empty until the active database
 * portfolio is supplied by an authenticated copilot workflow.
 */
export function buildPortfolioContext() {
  return JSON.stringify({
    status: "No portfolio context is connected to this request.",
    dataPolicy:
      "Do not invent holdings, prices, allocation, performance, news, or benchmark data.",
  });
}

export function createFallbackResponse(_question: string): CopilotResponse {
  return {
    answer:
      "The educational copilot is in demo mode. Connect an authenticated portfolio context before relying on portfolio-specific explanations.",
    highlights: [
      "No live market data",
      "No portfolio data connected",
      "Educational explanations only",
    ],
    caveat: "This is not financial, investment, or tax advice.",
    suggestedQuestions: [
      "What does diversification mean?",
      "What is sector concentration?",
    ],
  };
}
