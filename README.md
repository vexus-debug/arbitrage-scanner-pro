# Arbitrage Scanner Pro

# Lovable Build Prompt — Bybit Triangular Arbitrage Scanner (Prototype, No Backend/DB)



Paste everything below into Lovable as the project prompt.



---



## PROJECT OVERVIEW



Build a read-only, real-time research dashboard (single-page React app, no backend, no database) that scans Bybit's **public Spot market** — crypto pairs AND tokenized-stock/xStock pairs, since Bybit lists xStocks like NVDAXUSDT, AAPLXUSDT, TSLAXUSDT under the same Spot category — for genuine, executable 3-asset triangular arbitrage cycles.



Accuracy and honesty outrank everything else. If no profitable cycle exists, the app must say so explicitly: **"NO PROFITABLE ARBITRAGE OPPORTUNITY FOUND."** Never fabricate, simulate, or round-favorably a result.



This is a prototype: **no Supabase, no database, no server, no API keys.** All Bybit endpoints used are public and unauthenticated, called directly from the browser. All state (current opportunities, session history) lives in React memory only and resets on page reload — that's an accepted limitation of this prototype, not a bug to fix.



---



## TECH STACK



- React + Vite + TypeScript + Tailwind + shadcn/ui (Lovable defaults)

- No backend, no Supabase, no database of any kind

- All Bybit API calls made directly from the client via `fetch`

- In-memory state only (React state/context) for the current opportunity list and session-scoped history

- If Bybit's public REST endpoints reject direct browser calls due to CORS, fall back to a lightweight public CORS-proxy pattern (e.g. a Vite dev proxy config, or a `corsproxy.io`-style wrapper) — try direct calls first, since Bybit's public market-data endpoints generally allow cross-origin requests, and only add a proxy if requests actually fail in testing.



---



## BYBIT PUBLIC API — ENDPOINTS TO USE



Base URL: `https://api.bybit.com`



1. **`GET /v5/market/instruments-info?category=spot&status=Trading`** — discover every tradable spot symbol (crypto pairs AND xStock pairs like NVDAXUSDT, AAPLXUSDT, TSLAXUSDT, GOOGLXUSDT, CRCLXUSDT, HOODXUSDT). This is the source of truth for which assets/pairs exist — never hardcode a symbol list. Refresh every few minutes (instrument lists rarely change intra-session).

2. **`GET /v5/market/tickers?category=spot`** — one batched call returns last price, best bid/ask, 24h volume for all spot symbols. Use this as the cheap first-pass filter across the whole universe.

3. **`GET /v5/market/orderbook?category=spot&symbol=XXXX&limit=50`** — order-book depth per symbol, fetched only for cycles that clear the cheap filter, to compute real depth-weighted execution price and slippage before marking anything VERIFIED.

4. WebSocket (optional, add only if time allows): `wss://stream.bybit.com/v5/public/spot`, topic `tickers.{symbol}` — subscribe only to symbols currently involved in a tracked cycle, not the whole universe, to keep the browser connection manageable.



No Convert API in this prototype (requires authenticated account context). No account/fee-rate endpoint either (also authenticated) — use a configurable assumed fee rate instead (see below).



---



## CORE LOGIC — READ BEFORE BUILDING COMPONENTS



### 1. One graph, not separate crypto/stock engines

Every symbol from `instruments-info` — crypto pair or xStock pair — becomes a directed edge pair in the same graph: `baseCoin -> quoteCoin` and `quoteCoin -> baseCoin`. Tag each node with `category: crypto | xstock | stablecoin` for UI filtering only, applied *after* cycles are generated. Don't build separate pipelines for stocks vs crypto — stock↔crypto and stock↔stock cycles should fall out of the same generator automatically.



### 2. Cycle generation — prune before brute-forcing

- Build the adjacency list only from real edges returned by `instruments-info` — never assume a pair exists.

- Generate 3-cycles (A→B→C→A) only where edges A→B, B→C, C→A all exist.

- Most viable cycles will route through a bridge asset (USDT, USDC, BTC, ETH) for at least one leg, since xStocks mostly only pair against USDT — let the data show this, don't hardcode it.

- Test both directions (A→B→C→A and A→C→B→A) — never assume they're equally profitable.

- With hundreds of instruments this can still be a lot of combinations for a browser to hold — cap the initial full-universe pass at a sane symbol count (configurable, default e.g. top 300 by volume) for FULL SCAN, with an explicit note in the UI ("scanning top N by volume") rather than silently truncating.



### 3. Executable price, not last price

Two-pass design, entirely client-side:

- **Pass 1 (cheap):** use ticker bid/ask to estimate gross spread for every generated cycle. Discard anything below the user's minimum threshold immediately.

- **Pass 2 (expensive, only for survivors):** fetch the 3 order books for that cycle and compute the actual depth-weighted execution price for the requested capital — walk the book, consuming levels until the order size is filled, and average the executed price. This is what makes "scan the whole universe" realistic without a backend: the browser never fetches order books for cycles it already knows are unprofitable.



### 4. Fees

Default to Bybit's standard non-VIP spot taker fee (0.1% per leg, ≈0.3% round-trip across 3 legs) as an assumed rate, editable in Settings. Label it clearly in the UI as "assumed fee tier — not fetched from your account," since there's no authenticated fee-rate call in this prototype.



### 5. Slippage

Derived directly from step 3: `(depth-weighted execution price - best bid/ask) / best bid/ask`, displayed per leg.



### 6. Confidence status (exact logic)

- **VERIFIED**: all 3 legs have order-book data fetched within the staleness window (default 2–3s — realistic for browser fetch latency, not colocated-server latency), sufficient depth exists at the requested capital without exceeding a max price-impact threshold (default 1%), and net ROI after fees/slippage exceeds the user's minimum threshold.

- **CONDITIONAL**: ticker-only gross spread is positive but order-book depth hasn't been verified yet.

- **NOT PROFITABLE**: fully verified, net ROI ≤ 0.

- **NO LIQUIDITY**: order-book depth insufficient to fill the requested capital within the max price-impact threshold.

- **STALE DATA**: any leg's quote is older than the configured max age.

- **UNVERIFIED**: any required fetch failed or returned incomplete data.



### 7. No-result state (mandatory, exact shape)

When zero cycles pass validation, show prominently:



```

NO PROFITABLE ARBITRAGE OPPORTUNITY FOUND



[N] assets scanned · [N] valid cycles evaluated · scan took [X]s



Best candidate: [ROUTE]

Gross spread: [+/-X%]   Fees: [-X%]   Slippage: [-X%]   Net: [+/-X%]

Result: NOT PROFITABLE / NO LIQUIDITY / STALE DATA

```



Never omit this or leave an empty table with no explanation.



---



## STATE MANAGEMENT (no database)



- Keep all live data — instrument list, current ticker snapshot, current opportunity list — in React state/context, refreshed on a polling interval (default every 5–10s, configurable; respect Bybit's public rate limits and back off on 429s).

- Keep a **session-only history array** (in memory) of past scan results for the current browser session, capped at a reasonable size (e.g. last 200 entries), used to power a simple in-session "Logbook" view and basic analytics (avg net ROI this session, most frequent route this session, etc.).

- Clearly label the Logbook/Analytics views as "this session only — resets on reload," since there's no persistence layer in this prototype. Don't imply historical data survives a refresh.



---



## PAGES / UI



1. **Dashboard**: status banner (LIVE/OFFLINE), scan stats (assets scanned, cycles evaluated, last scan duration, last poll time), opportunity table — columns: Rank, Route, Capital, Gross ROI, Fees, Slippage, Net ROI, Net Profit, Liquidity, Status — and the prominent NO_RESULT state when the table is empty.

2. **Opportunity Detail** (click-through or expandable row): 3-leg breakdown (input/expected output/slippage/fee per leg), final result block, VERIFIED/THEORETICAL badge, a "View Execution Steps" panel that is explicitly display-only ("not automated — verify current prices before trading manually").

3. **Session Logbook**: table of this session's detected opportunities, filterable by category (crypto/xstock/mixed), status, min ROI, route — labeled as session-only.

4. **Session Analytics**: simple stats computed from the in-memory history — count, avg/median net ROI, most frequent route, most common failure reason this session.

5. **Settings**: starting capital, min net ROI threshold, min net profit threshold, assumed fee rate, max quote age, scan mode (Fast = top N by volume / Full = whole universe capped as above / Custom = pick categories), asset category filter (All / Crypto / Stablecoins / xStocks).



Dark, dense, terminal-style UI — tables and numbers over decoration, quant-research-tool feel rather than generic SaaS.



## TESTING



Add a `MOCK_MODE` toggle in Settings (not an env var, since there's no backend) that swaps live fetches for a small deterministic fixture dataset, to sanity-check: cycle detection, reverse-route asymmetry, fee math, slippage math, insufficient-liquidity handling, stale-quote handling, zero/negative spreads, and duplicate-route dedup. When MOCK_MODE is on, show a persistent, unmissable banner ("MOCK DATA — not live") so it's never confused with real output.



## NON-NEGOTIABLES



- No hardcoded prices, symbol lists, or example "profitable" trades in the live code path.

- No API keys, secrets, or authenticated Bybit calls anywhere — public endpoints only.

- No automatic order placement.

- No database, no backend — pure client-side fetch + in-memory state, by design for this prototype.

- Every displayed number traces to a real fetched 

value or a clearly-labeled assumption (fee rate).

- Prefer showing nothing profitable over showing something wrong.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/09146c31-78b4-43fd-a4d0-0cb324d56881).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
