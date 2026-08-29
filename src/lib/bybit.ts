import type { Instrument, Ticker } from "./types";

const BASE = "https://api.bybit.com";
const PROXY = "https://corsproxy.io/?url=";

let useProxy = false;

export function isProxied() {
  return useProxy;
}

async function raw(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { retCode?: number; retMsg?: string; result?: unknown };
  if (json.retCode !== undefined && json.retCode !== 0) {
    throw new Error(json.retMsg || `retCode ${json.retCode}`);
  }
  return json.result;
}

/** Try a direct browser call first; fall back to a public CORS proxy only if it fails. */
async function apiGet(path: string, signal?: AbortSignal): Promise<unknown> {
  const direct = BASE + path;
  if (!useProxy) {
    try {
      return await raw(direct, signal);
    } catch (err) {
      if (signal?.aborted) throw err;
      useProxy = true;
    }
  }
  return raw(PROXY + encodeURIComponent(direct), signal);
}

interface InstrumentRow {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
}

export async function fetchInstruments(signal?: AbortSignal): Promise<Instrument[]> {
  const result = (await apiGet(
    "/v5/market/instruments-info?category=spot&status=Trading",
    signal,
  )) as { list?: InstrumentRow[] };
  return (result?.list ?? [])
    .filter((r) => r.status === "Trading" && r.baseCoin && r.quoteCoin)
    .map((r) => ({ symbol: r.symbol, baseCoin: r.baseCoin, quoteCoin: r.quoteCoin }));
}

interface TickerRow {
  symbol: string;
  bid1Price: string;
  ask1Price: string;
  lastPrice: string;
  turnover24h: string;
}

export async function fetchTickers(signal?: AbortSignal): Promise<Map<string, Ticker>> {
  const result = (await apiGet("/v5/market/tickers?category=spot", signal)) as {
    list?: TickerRow[];
  };
  const ts = Date.now();
  const map = new Map<string, Ticker>();
  for (const r of result?.list ?? []) {
    const bid = Number(r.bid1Price);
    const ask = Number(r.ask1Price);
    if (!(bid > 0) || !(ask > 0)) continue;
    map.set(r.symbol, {
      symbol: r.symbol,
      bid,
      ask,
      last: Number(r.lastPrice) || bid,
      turnover24h: Number(r.turnover24h) || 0,
      ts,
    });
  }
  return map;
}

export interface OrderBook {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  ts: number;
}

export async function fetchOrderBook(symbol: string, signal?: AbortSignal): Promise<OrderBook> {
  const result = (await apiGet(
    `/v5/market/orderbook?category=spot&symbol=${encodeURIComponent(symbol)}&limit=50`,
    signal,
  )) as { b?: [string, string][]; a?: [string, string][]; ts?: number };
  return {
    symbol,
    bids: (result?.b ?? []).map(([p, s]) => [Number(p), Number(s)] as [number, number]),
    asks: (result?.a ?? []).map(([p, s]) => [Number(p), Number(s)] as [number, number]),
    ts: Date.now(),
  };
}
