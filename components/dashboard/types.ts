export type Holding = {
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  price: number;
  marketValue: number;
  dailyChangePercent: number;
  allocationPercent: number;
};

export type Allocation = {
  label: string;
  value: number;
  color: string;
};

export type RiskSignal = {
  level: "low" | "medium" | "high";
  title: string;
  detail: string;
};
