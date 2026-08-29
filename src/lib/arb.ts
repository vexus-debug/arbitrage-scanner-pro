import type { OrderBook } from "./bybit";
import type {
  AssetCategory,
  Instrument,
  Leg,
  Opportunity,
  OpportunityStatus,
  Settings,
  Ticker,
} from "./types";

export const STABLES = new Set([
  "USDT",
  "USDC",
  "USDE",
  "FDUSD",
  "TUSD",
  "DAI",
  "BUSD",
  "USDD",
  "EURT",
  "EURR",
  "BRZ",
]);

/**
 * Heuristic only: Bybit's spot instruments endpoint does not flag tokenized stocks,
 * and xStock tickers are published as <TICKER>X (NVDAX, AAPLX, TSLAX...).
 */
export function categorize(coin: string): AssetCategory {
  if (STABLES.has(coin)) return "stablecoin";
  if (/^[A-Z]{2,5}X$/.test(coin) && !["FLUX", "PAX", "MATX"].includes(coin)) return "xstock";
  return "crypto";
}

export interface Edge {
  to: string;
  symbol: string;
  side: "buy" | "sell";
}

export function buildGraph(instruments: Instrument[]) {
  const adj = new Map<string, Edge[]>();
  const push = (from: string, edge: Edge) => {
    const list = adj.get(from);
    if (list) list.push(edge);
    else adj.set(from, [edge]);
  };
  for (const inst of instruments) {
    push(inst.baseCoin, { to: inst.quoteCoin, symbol: inst.symbol, side: "sell" });
    push(inst.quoteCoin, { to: inst.baseCoin, symbol: inst.symbol, side: "buy" });
  }
  return adj;
}

export interface RawCycle {
  nodes: [string, string, string];
  edges: [Edge, Edge, Edge];
}

/** Enumerate directed 3-cycles A->B->C->A. Both directions are produced and kept. */
export function findCycles(adj: Map<string, Edge[]>, maxCycles = 20000): RawCycle[] {
  const out: RawCycle[] = [];
  const seen = new Set<string>();
  for (const [a, aEdges] of adj) {
    for (const e1 of aEdges) {
      const b = e1.to;
      if (b === a) continue;
      const bEdges = adj.get(b);
      if (!bEdges) continue;
      for (const e2 of bEdges) {
        const c = e2.to;
        if (c === a || c === b) continue;
        const cEdges = adj.get(c);
        if (!cEdges) continue;
        for (const e3 of cEdges) {
          if (e3.to !== a) continue;
          // dedup rotations of the same directed cycle
          const rots = [
            `${a}|${b}|${c}|${e1.symbol}|${e2.symbol}|${e3.symbol}`,
            `${b}|${c}|${a}|${e2.symbol}|${e3.symbol}|${e1.symbol}`,
            `${c}|${a}|${b}|${e3.symbol}|${e1.symbol}|${e2.symbol}`,
          ].sort();
          const key = rots[0];
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ nodes: [a, b, c], edges: [e1, e2, e3] });
          if (out.length >= maxCycles) return out;
        }
      }
    }
  }
  return out;
}

/** Top-of-book conversion rate for one leg (units of `to` per unit of `from`). */
export function quoteRate(edge: Edge, t: Ticker): number {
  return edge.side === "sell" ? t.bid : 1 / t.ask;
}

/** USD value of one unit of a coin, derived from live tickers only. */
export function usdPrice(coin: string, tickers: Map<string, Ticker>): number | null {
  if (STABLES.has(coin)) return 1;
  for (const q of ["USDT", "USDC"]) {
    const t = tickers.get(`${coin}${q}`);
    if (t) return (t.bid + t.ask) / 2;
  }
  return null;
}

function rotateStart(cycle: RawCycle, tickers: Map<string, Ticker>) {
  const { nodes, edges } = cycle;
  const score = (coin: string) => {
    if (coin === "USDT") return 3;
    if (coin === "USDC") return 2;
    if (STABLES.has(coin)) return 1;
    return usdPrice(coin, tickers) !== null ? 0 : -1;
  };
  let best = 0;
  for (let i = 1; i < 3; i++) if (score(nodes[i]) > score(nodes[best])) best = i;
  if (score(nodes[best]) < 0) return null;
  const n = [nodes[best], nodes[(best + 1) % 3], nodes[(best + 2) % 3]] as [string, string, string];
  const e = [edges[best], edges[(best + 1) % 3], edges[(best + 2) % 3]] as [Edge, Edge, Edge];
  return { nodes: n, edges: e };
}

export interface EvaluatedCycle extends Opportunity {}

/** Pass 1: ticker-only evaluation. Returns null if any leg lacks a usable quote. */
export function evaluateWithTickers(
  cycle: RawCycle,
  tickers: Map<string, Ticker>,
  settings: Settings,
  now = Date.now(),
): Opportunity | null {
  const rotated = rotateStart(cycle, tickers);
  if (!rotated) return null;
  const { nodes, edges } = rotated;
  const startCoin = nodes[0];
  const startUsd = usdPrice(startCoin, tickers);
  if (!startUsd || startUsd <= 0) return null;

  const fee = settings.feePctPerLeg / 100;
  let stale = false;
  let amount = settings.capitalUsd / startUsd;
  const capitalStart = amount;
  const legs: Leg[] = [];
  let product = 1;

  for (let i = 0; i < 3; i++) {
    const edge = edges[i];
    const t = tickers.get(edge.symbol);
    if (!t) return null;
    if (now - t.ts > settings.maxQuoteAgeMs) stale = true;
    const rate = quoteRate(edge, t);
    if (!(rate > 0) || !Number.isFinite(rate)) return null;
    const out = amount * rate * (1 - fee);
    legs.push({
      from: nodes[i],
      to: nodes[(i + 1) % 3],
      symbol: edge.symbol,
      side: edge.side,
      quoteRate: rate,
      amountIn: amount,
      amountOut: out,
      feePct: settings.feePctPerLeg,
    });
    product *= rate;
    amount = out;
  }

  const grossRoiPct = (product - 1) * 100;
  const feesPct = (1 - Math.pow(1 - fee, 3)) * 100;
  const netRoiPct = (amount / capitalStart - 1) * 100;
  const netProfitUsd = (amount - capitalStart) * startUsd;
  const cats = nodes.map(categorize);
  const nonStable = cats.filter((c) => c !== "stablecoin");
  const categoryTag: Opportunity["categoryTag"] =
    nonStable.length === 0
      ? "crypto"
      : nonStable.every((c) => c === "xstock")
        ? "xstock"
        : nonStable.every((c) => c === "crypto")
          ? "crypto"
          : "mixed";

  const status: OpportunityStatus = stale
    ? "STALE DATA"
    : netRoiPct > 0
      ? "CONDITIONAL"
      : "NOT PROFITABLE";

  return {
    id: `${nodes.join(">")}::${legs.map((l) => l.symbol).join("-")}`,
    route: [...nodes, nodes[0]],
    legs,
    startCoin,
    capitalUsd: settings.capitalUsd,
    capitalStart,
    grossRoiPct,
    feesPct,
    slippagePct: 0,
    netRoiPct,
    netProfitUsd,
    liquidityUsd: null,
    categories: cats,
    categoryTag,
    status,
    verified: false,
    reason: stale ? "Ticker snapshot older than max quote age" : undefined,
    detectedAt: now,
  };
}

/** Walk one side of a book. Returns filled output + notional consumed, or null if too thin. */
function walkBook(levels: [number, number][], amountIn: number, side: "sell" | "buy") {
  let remaining = amountIn;
  let out = 0;
  for (const [price, size] of levels) {
    if (!(price > 0) || !(size > 0)) continue;
    if (side === "sell") {
      // spending base, receiving quote
      const take = Math.min(remaining, size);
      out += take * price;
      remaining -= take;
    } else {
      // spending quote, receiving base
      const levelCost = price * size;
      const spend = Math.min(remaining, levelCost);
      out += spend / price;
      remaining -= spend;
    }
    if (remaining <= 1e-12) break;
  }
  if (remaining > 1e-9) return null;
  return out;
}

export interface VerifyInput {
  opportunity: Opportunity;
  books: Record<string, OrderBook | null>;
  tickers: Map<string, Ticker>;
  settings: Settings;
  now?: number;
}

/** Pass 2: depth-weighted execution over real order books. */
export function verifyWithBooks({
  opportunity,
  books,
  tickers,
  settings,
  now = Date.now(),
}: VerifyInput): Opportunity {
  const fee = settings.feePctPerLeg / 100;
  const startUsd = usdPrice(opportunity.startCoin, tickers) ?? 1;
  let amount = opportunity.capitalStart;
  const legs: Leg[] = [];
  let worstSlip = 0;
  let liquidityUsd: number | null = null;
  let status: OpportunityStatus | null = null;
  let reason: string | undefined;

  for (const leg of opportunity.legs) {
    const book = books[leg.symbol];
    if (!book || book.bids.length === 0 || book.asks.length === 0) {
      status = "UNVERIFIED";
      reason = `Order book unavailable for ${leg.symbol}`;
      legs.push({ ...leg, amountIn: amount, amountOut: amount * leg.quoteRate * (1 - fee) });
      amount = amount * leg.quoteRate * (1 - fee);
      continue;
    }
    if (now - book.ts > settings.maxQuoteAgeMs) {
      status = status ?? "STALE DATA";
      reason = reason ?? `Order book for ${leg.symbol} older than ${settings.maxQuoteAgeMs}ms`;
    }
    const levels = leg.side === "sell" ? book.bids : book.asks;
    const top = levels[0][0];
    const filled = walkBook(levels, amount, leg.side);
    if (filled === null || filled <= 0) {
      status = "NO LIQUIDITY";
      reason = `Insufficient depth on ${leg.symbol} for ${amount.toPrecision(6)} ${leg.from}`;
      legs.push({
        ...leg,
        amountIn: amount,
        amountOut: 0,
        depthOk: false,
        bookTs: book.ts,
      });
      amount = 0;
      break;
    }
    const execRate = filled / amount;
    const topRate = leg.side === "sell" ? top : 1 / top;
    const slippagePct = ((topRate - execRate) / topRate) * 100;
    worstSlip = Math.max(worstSlip, slippagePct);
    if (slippagePct > settings.maxPriceImpactPct) {
      status = "NO LIQUIDITY";
      reason = `Price impact ${slippagePct.toFixed(3)}% on ${leg.symbol} exceeds ${settings.maxPriceImpactPct}% cap`;
    }
    const notional = leg.side === "sell" ? filled : amount;
    const legUsd = notional * (usdPrice(leg.side === "sell" ? leg.to : leg.from, tickers) ?? 0);
    liquidityUsd = liquidityUsd === null ? legUsd : Math.min(liquidityUsd, legUsd);
    const out = filled * (1 - fee);
    legs.push({
      ...leg,
      amountIn: amount,
      amountOut: out,
      execRate,
      slippagePct,
      bookTs: book.ts,
      depthOk: true,
    });
    amount = out;
  }

  const netRoiPct = (amount / opportunity.capitalStart - 1) * 100;
  const netProfitUsd = (amount - opportunity.capitalStart) * startUsd;
  const grossRate = legs.reduce((acc, l) => acc * (l.execRate ?? l.quoteRate), 1);
  const totalSlipPct = legs.reduce((acc, l) => acc + (l.slippagePct ?? 0), 0);

  if (!status) {
    const passes =
      netRoiPct >= settings.minNetRoiPct && netProfitUsd >= settings.minNetProfitUsd;
    status = passes ? "VERIFIED" : "NOT PROFITABLE";
    if (!passes) {
      reason =
        netRoiPct <= 0
          ? "Net ROI after fees and slippage is negative"
          : `Net ROI ${netRoiPct.toFixed(4)}% below thresholds`;
    }
  }

  return {
    ...opportunity,
    legs,
    grossRoiPct: (grossRate - 1) * 100,
    slippagePct: totalSlipPct,
    netRoiPct,
    netProfitUsd,
    liquidityUsd,
    status,
    verified: status === "VERIFIED" || status === "NOT PROFITABLE" || status === "NO LIQUIDITY",
    reason,
    detectedAt: now,
  };
}
