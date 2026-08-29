import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchInstruments, fetchOrderBook, fetchTickers, isProxied, type OrderBook } from "./bybit";
import {
  buildGraph,
  categorize,
  evaluateWithTickers,
  findCycles,
  verifyWithBooks,
} from "./arb";
import { MOCK_INSTRUMENTS, mockOrderBook, mockTickers } from "./mock";
import {
  DEFAULT_SETTINGS,
  type Instrument,
  type Opportunity,
  type ScanStats,
  type Settings,
  type Ticker,
} from "./types";

const HISTORY_CAP = 200;
const INSTRUMENT_TTL_MS = 5 * 60 * 1000;

interface ScannerState {
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  opportunities: Opportunity[];
  bestCandidate: Opportunity | null;
  stats: ScanStats | null;
  history: Opportunity[];
  clearHistory: () => void;
  scanning: boolean;
  online: boolean;
  proxied: boolean;
  lastError: string | null;
  runScan: () => void;
}

const Ctx = createContext<ScannerState | null>(null);

export function useScanner() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScanner must be used inside ScannerProvider");
  return ctx;
}

export function ScannerProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [bestCandidate, setBestCandidate] = useState<Opportunity | null>(null);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [history, setHistory] = useState<Opportunity[]>([]);
  const [scanning, setScanning] = useState(false);
  const [online, setOnline] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [proxied, setProxied] = useState(false);

  const instrumentCache = useRef<{ at: number; list: Instrument[] } | null>(null);
  const running = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((s) => ({ ...s, ...patch }));
  }, []);
  const resetSettings = useCallback(() => setSettingsState(DEFAULT_SETTINGS), []);
  const clearHistory = useCallback(() => setHistory([]), []);

  const runScan = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setScanning(true);
    const cfg = settingsRef.current;
    const started = performance.now();
    try {
      let instruments: Instrument[];
      let tickers: Map<string, Ticker>;

      if (cfg.mockMode) {
        instruments = MOCK_INSTRUMENTS;
        tickers = mockTickers();
      } else {
        const cache = instrumentCache.current;
        instruments =
          cache && Date.now() - cache.at < INSTRUMENT_TTL_MS
            ? cache.list
            : await fetchInstruments();
        instrumentCache.current = { at: Date.now(), list: instruments };
        tickers = await fetchTickers();
      }
      setProxied(isProxied());

      // universe selection: rank real symbols by 24h turnover, never a hardcoded list
      let universe = instruments.filter((i) => tickers.has(i.symbol));
      if (cfg.categoryFilter !== "all" && cfg.scanMode === "custom") {
        universe = universe.filter(
          (i) =>
            categorize(i.baseCoin) === cfg.categoryFilter ||
            categorize(i.quoteCoin) === cfg.categoryFilter,
        );
      }
      universe.sort(
        (a, b) => (tickers.get(b.symbol)?.turnover24h ?? 0) - (tickers.get(a.symbol)?.turnover24h ?? 0),
      );
      const cap = cfg.scanMode === "fast" ? Math.min(cfg.universeCap, 120) : cfg.universeCap;
      universe = universe.slice(0, cap);

      const graph = buildGraph(universe);
      const cycles = findCycles(graph);
      const now = Date.now();

      const evaluated: Opportunity[] = [];
      for (const cycle of cycles) {
        const opp = evaluateWithTickers(cycle, tickers, cfg, now);
        if (opp) evaluated.push(opp);
      }
      evaluated.sort((a, b) => b.netRoiPct - a.netRoiPct);

      const survivors = evaluated
        .filter((o) => o.netRoiPct >= cfg.minNetRoiPct && o.status !== "STALE DATA")
        .slice(0, cfg.maxVerifyPerScan);

      const verified: Opportunity[] = [];
      for (const opp of survivors) {
        const symbols = Array.from(new Set(opp.legs.map((l) => l.symbol)));
        const books: Record<string, OrderBook | null> = {};
        await Promise.all(
          symbols.map(async (sym) => {
            try {
              books[sym] = cfg.mockMode ? mockOrderBook(sym) : await fetchOrderBook(sym);
            } catch {
              books[sym] = null;
            }
          }),
        );
        verified.push(verifyWithBooks({ opportunity: opp, books, tickers, settings: cfg }));
      }

      const passing = verified
        .filter(
          (o) =>
            o.status === "VERIFIED" &&
            o.netRoiPct >= cfg.minNetRoiPct &&
            o.netProfitUsd >= cfg.minNetProfitUsd,
        )
        .sort((a, b) => b.netRoiPct - a.netRoiPct);

      const best =
        verified.sort((a, b) => b.netRoiPct - a.netRoiPct)[0] ?? evaluated[0] ?? null;

      const coins = new Set<string>();
      for (const i of universe) {
        coins.add(i.baseCoin);
        coins.add(i.quoteCoin);
      }

      setOpportunities(passing);
      setBestCandidate(best);
      setStats({
        assetsScanned: coins.size,
        symbolsScanned: universe.length,
        cyclesEvaluated: evaluated.length,
        cyclesVerified: verified.length,
        durationMs: performance.now() - started,
        finishedAt: Date.now(),
      });
      setHistory((h) => [...passing, ...(best && passing.length === 0 ? [best] : [])].concat(h).slice(0, HISTORY_CAP));
      setOnline(true);
      setLastError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOnline(false);
      setLastError(message);
      setStats((prev) => ({
        assetsScanned: prev?.assetsScanned ?? 0,
        symbolsScanned: prev?.symbolsScanned ?? 0,
        cyclesEvaluated: prev?.cyclesEvaluated ?? 0,
        cyclesVerified: 0,
        durationMs: performance.now() - started,
        finishedAt: Date.now(),
        error: message,
      }));
      setOpportunities([]);
    } finally {
      running.current = false;
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (cancelled) return;
      await runScan();
      if (cancelled || !settingsRef.current.autoScan) return;
      timer = setTimeout(loop, settingsRef.current.pollIntervalMs);
    };
    if (settings.autoScan) {
      void loop();
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runScan, settings.autoScan, settings.pollIntervalMs, settings.mockMode, settings.scanMode]);

  const value = useMemo<ScannerState>(
    () => ({
      settings,
      setSettings,
      resetSettings,
      opportunities,
      bestCandidate,
      stats,
      history,
      clearHistory,
      scanning,
      online,
      proxied,
      lastError,
      runScan: () => void runScan(),
    }),
    [
      settings,
      setSettings,
      resetSettings,
      opportunities,
      bestCandidate,
      stats,
      history,
      clearHistory,
      scanning,
      online,
      proxied,
      lastError,
      runScan,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
