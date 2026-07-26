import type { Allocation, Holding, RiskSignal } from "./types";

export const portfolio = {
  ownerName: "Chris",
  totalValue: 31391,
  dailyChange: -299.18,
  dailyChangePercent: -0.94,
  totalGain: 4386.52,
  totalGainPercent: 16.24,
  diversificationScore: 63,
  invested: 27004.48,
};

export const holdings: Holding[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", quantity: 40, price: 212.98, marketValue: 8519.2, dailyChangePercent: -1.2, allocationPercent: 27.14 },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", sector: "Broad market", quantity: 15, price: 521.96, marketValue: 7829.4, dailyChangePercent: -0.7, allocationPercent: 24.94 },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", quantity: 12, price: 411.22, marketValue: 4934.64, dailyChangePercent: -0.9, allocationPercent: 15.72 },
  { symbol: "COST", name: "Costco Wholesale", sector: "Consumer defensive", quantity: 4, price: 918.49, marketValue: 3673.96, dailyChangePercent: -0.2, allocationPercent: 11.7 },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", quantity: 25, price: 141.34, marketValue: 3533.5, dailyChangePercent: -2.8, allocationPercent: 11.26 },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", quantity: 18, price: 161.12, marketValue: 2900.16, dailyChangePercent: 0.3, allocationPercent: 9.24 },
];

export const allocation: Allocation[] = [
  { label: "Technology", value: 54.1, color: "#7489e6" },
  { label: "Broad market", value: 24.9, color: "#8cb89b" },
  { label: "Consumer defensive", value: 11.7, color: "#e7af80" },
  { label: "Healthcare", value: 9.3, color: "#d58aa5" },
];

export const riskSignals: RiskSignal[] = [
  { level: "medium", title: "Technology concentration", detail: "54.1% of your portfolio is in one sector, so related market events may have a larger impact." },
  { level: "medium", title: "Largest holding", detail: "Apple represents 27.1% of portfolio value, which gives a single company meaningful influence." },
  { level: "low", title: "Broad-market exposure", detail: "Your S&P 500 ETF provides exposure to a broad basket of large U.S. companies." },
];

export const performancePoints = [24, 29, 27, 35, 32, 41, 38, 45, 43, 49, 47, 54, 50, 58, 56, 62, 59, 66, 64, 72, 69, 76, 74, 81];
