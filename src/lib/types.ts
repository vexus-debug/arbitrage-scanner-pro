export type AssetCategory = "crypto" | "xstock" | "stablecoin";

export interface Instrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
}

export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  turnover24h: number;
  ts: number;
}

export type LegSide = "buy" | "sell";

export interface Leg {
  from: string;
  to: string;
  symbol: string;
  side: LegSide; // sell = base->quote, buy = quote->base
  quoteRate: number; // top-of-book conversion rate from->to
  execRate?: number; // depth-weighted conversion rate from->to
  slippagePct?: number;
  amountIn: number;
  amountOut: number;
  feePct: number;
  bookTs?: number;
  depthOk?: boolean;
}

export type OpportunityStatus =
  | "VERIFIED"
  | "CONDITIONAL"
  | "NOT PROFITABLE"
  | "NO LIQUIDITY"
  | "STALE DATA"
  | "UNVERIFIED";

export interface Opportunity {
  id: string;
  route: string[]; // [A,B,C,A]
  legs: Leg[];
  startCoin: string;
  capitalUsd: number;
  capitalStart: number;
  grossRoiPct: number;
  feesPct: number;
  slippagePct: number;
  netRoiPct: number;
  netProfitUsd: number;
  liquidityUsd: number | null;
  categories: AssetCategory[];
  categoryTag: "crypto" | "xstock" | "mixed";
  status: OpportunityStatus;
  verified: boolean;
  reason?: string;
  detectedAt: number;
}

export interface ScanStats {
  assetsScanned: number;
  symbolsScanned: number;
  cyclesEvaluated: number;
  cyclesVerified: number;
  durationMs: number;
  finishedAt: number;
  error?: string;
}

export type ScanMode = "fast" | "full" | "custom";
export type CategoryFilter = "all" | "crypto" | "stablecoin" | "xstock";

export interface Settings {
  capitalUsd: number;
  minNetRoiPct: number;
  minNetProfitUsd: number;
  feePctPerLeg: number;
  maxQuoteAgeMs: number;
  maxPriceImpactPct: number;
  scanMode: ScanMode;
  universeCap: number;
  categoryFilter: CategoryFilter;
  pollIntervalMs: number;
  maxVerifyPerScan: number;
  mockMode: boolean;
  autoScan: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  capitalUsd: 1000,
  minNetRoiPct: 0.05,
  minNetProfitUsd: 0.5,
  feePctPerLeg: 0.1,
  maxQuoteAgeMs: 3000,
  maxPriceImpactPct: 1,
  scanMode: "fast",
  universeCap: 300,
  categoryFilter: "all",
  pollIntervalMs: 8000,
  maxVerifyPerScan: 8,
  mockMode: false,
  autoScan: true,
};
