import {
  allocation,
  holdings,
  portfolio,
  riskSignals,
} from "@/components/dashboard/mock-data";
import type { CopilotResponse } from "./types";

export function buildPortfolioContext() {
  return JSON.stringify({
    asOf: "Mock portfolio data — not live market data",
    portfolioValue: portfolio.totalValue,
    diversificationScore: portfolio.diversificationScore,
    holdings: holdings.map(
      ({
        symbol,
        name,
        sector,
        marketValue,
        allocationPercent,
        dailyChangePercent,
      }) => ({
        symbol,
        name,
        sector,
        marketValue,
        allocationPercent,
        dailyChangePercent,
      }),
    ),
    sectorAllocation: allocation.map(({ label, value }) => ({
      sector: label,
      percentage: value,
    })),
    riskSignals: riskSignals.map(({ level, title, detail }) => ({
      level,
      title,
      detail,
    })),
  });
}

export function createFallbackResponse(question: string): CopilotResponse {
  const normalized = question.toLowerCase();
  if (normalized.includes("sector") || normalized.includes("exposure"))
    return {
      answer:
        "Technology is your largest sector exposure at 54.1%, followed by broad-market exposure through VOO at 24.9%. Sector concentration matters because companies in the same area of the market can react similarly to earnings trends, interest rates, and economic news.",
      highlights: [
        "Technology: 54.1% of portfolio",
        "Broad-market ETF: 24.9%",
        "Four sectors represented",
      ],
      caveat:
        "This is educational context based on mock holdings, not a recommendation to make changes.",
      suggestedQuestions: [
        "How concentrated is my portfolio?",
        "Explain my largest holdings",
      ],
    };
  if (normalized.includes("risk") || normalized.includes("divers"))
    return {
      answer:
        "The portfolio has six holdings across four sectors and a diversification score of 63 out of 100. Its main concentration signals are technology exposure and Apple’s 27.1% portfolio weight. Diversification is about understanding how a shared event could affect multiple positions at once.",
      highlights: [
        "Diversification score: 63/100",
        "Apple: 27.1% of portfolio",
        "Technology: 54.1% of portfolio",
      ],
      caveat:
        "This describes portfolio structure for education only; it does not tell you what action to take.",
      suggestedQuestions: [
        "What does the diversification score mean?",
        "What risks does technology exposure create?",
      ],
    };
  return {
    answer:
      "Your mock portfolio is worth $31,391 across six positions. Apple and VOO are the largest holdings, while technology is the largest sector exposure. I can help translate those facts into plain-English context, identify concentration patterns, or explain an individual holding.",
    highlights: [
      "Six positions across four sectors",
      "Largest holding: Apple",
      "Largest sector: Technology",
    ],
    caveat:
      "This is educational analysis based on mock portfolio data, not financial advice or a recommendation.",
    suggestedQuestions: [
      "Explain my largest holdings",
      "What sectors am I exposed to?",
    ],
  };
}
