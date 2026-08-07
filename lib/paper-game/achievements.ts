export const PAPER_ACHIEVEMENTS = [
  { key: "FIRST_PORTFOLIO", name: "First Portfolio", description: "Create your first simulated portfolio.", category: "Getting started", xpReward: 50, criteriaKey: "PORTFOLIO_COUNT_1" },
  { key: "FIRST_TRADE", name: "First Simulated Trade", description: "Record your first simulated buy.", category: "Getting started", xpReward: 50, criteriaKey: "BUY_COUNT_1" },
  { key: "FIRST_SELL", name: "First Simulated Sell", description: "Record your first simulated sell.", category: "Getting started", xpReward: 50, criteriaKey: "SELL_COUNT_1" },
  { key: "FIVE_HOLDINGS", name: "Five Holdings", description: "Build a simulated portfolio with five positions.", category: "Portfolio building", xpReward: 100, criteriaKey: "POSITION_COUNT_5" },
  { key: "SEVEN_DAY_STREAK", name: "Seven-Day Learner", description: "Complete meaningful learning activity on seven days.", category: "Engagement", xpReward: 125, criteriaKey: "STREAK_7" },
] as const;
