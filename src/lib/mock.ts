import type { OrderBook } from "./bybit";
import type { Instrument, Ticker } from "./types";

/**
 * Deterministic fixture universe used only when MOCK_MODE is enabled in Settings.
 * Covers: a profitable cycle, a reverse route that is unprofitable, a thin-book
 * cycle that must resolve to NO LIQUIDITY, and an xStock leg.
 */
export const MOCK_INSTRUMENTS: Instrument[] = [
  { symbol: "BTCUSDT", baseCoin: "BTC", quoteCoin: "USDT" },
  { symbol: "ETHUSDT", baseCoin: "ETH", quoteCoin: "USDT" },
  { symbol: "ETHBTC", baseCoin: "ETH", quoteCoin: "BTC" },
  { symbol: "SOLUSDT", baseCoin: "SOL", quoteCoin: "USDT" },
  { symbol: "SOLBTC", baseCoin: "SOL", quoteCoin: "BTC" },
  { symbol: "NVDAXUSDT", baseCoin: "NVDAX", quoteCoin: "USDT" },
  { symbol: "NVDAXUSDC", baseCoin: "NVDAX", quoteCoin: "USDC" },
  { symbol: "USDCUSDT", baseCoin: "USDC", quoteCoin: "USDT" },
];

const T = (
  symbol: string,
  bid: number,
  ask: number,
  turnover24h: number,
  ts: number,
): Ticker => ({ symbol, bid, ask, last: (bid + ask) / 2, turnover24h, ts });

export function mockTickers(now = Date.now()): Map<string, Ticker> {
  const rows: Ticker[] = [
    T("BTCUSDT", 60000, 60006, 900_000_000, now),
    T("ETHUSDT", 3000, 3000.3, 500_000_000, now),
    // ETHBTC deliberately mispriced upward -> USDT->ETH->BTC->USDT is profitable
    T("ETHBTC", 0.05035, 0.050361, 80_000_000, now),
    T("SOLUSDT", 150, 150.02, 200_000_000, now),
    T("SOLBTC", 0.0025, 0.0025002, 20_000_000, now),
    T("NVDAXUSDT", 120.5, 120.56, 3_000_000, now),
    T("NVDAXUSDC", 120.9, 120.95, 1_000_000, now),
    T("USDCUSDT", 0.9999, 1.0, 300_000_000, now),
  ];
  return new Map(rows.map((r) => [r.symbol, r]));
}

function book(symbol: string, mid: number, spread: number, depth: number, ts: number): OrderBook {
  const bids: [number, number][] = [];
  const asks: [number, number][] = [];
  for (let i = 0; i < 20; i++) {
    bids.push([mid * (1 - spread / 2 - i * 0.0002), depth]);
    asks.push([mid * (1 + spread / 2 + i * 0.0002), depth]);
  }
  return { symbol, bids, asks, ts };
}

export function mockOrderBook(symbol: string, now = Date.now()): OrderBook {
  const t = mockTickers(now).get(symbol);
  const mid = t ? (t.bid + t.ask) / 2 : 1;
  // NVDAX books are deliberately thin -> exercises the NO LIQUIDITY path.
  const thin = symbol.startsWith("NVDAX");
  const depth = thin ? 0.05 : mid > 1000 ? 2 : mid > 10 ? 400 : 60;
  return book(symbol, mid, thin ? 0.001 : 0.0001, depth, now);
}
