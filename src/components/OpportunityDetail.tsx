import { StatusBadge } from "./StatusBadge";
import { num, pct, time, usd, compactUsd } from "@/lib/format";
import type { Opportunity } from "@/lib/types";

export function OpportunityDetail({ opp }: { opp: Opportunity }) {
  return (
    <div className="space-y-4 border-t border-border bg-surface/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={opp.status} />
        <span
          className={`rounded-sm border px-1.5 py-0.5 text-[0.6rem] tracking-[0.12em] ${
            opp.verified ? "border-profit/50 text-profit" : "border-warn/50 text-warn"
          }`}
        >
          {opp.verified ? "ORDER-BOOK VERIFIED" : "THEORETICAL (TICKER ONLY)"}
        </span>
        <span className="term-label">detected {time(opp.detectedAt)}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="term-label border-b border-border text-left">
              <th className="py-1 pr-3">Leg</th>
              <th className="py-1 pr-3">Symbol</th>
              <th className="py-1 pr-3">Side</th>
              <th className="py-1 pr-3">Input</th>
              <th className="py-1 pr-3">Quote rate</th>
              <th className="py-1 pr-3">Exec rate</th>
              <th className="py-1 pr-3">Slippage</th>
              <th className="py-1 pr-3">Fee</th>
              <th className="py-1">Expected output</th>
            </tr>
          </thead>
          <tbody>
            {opp.legs.map((leg, i) => (
              <tr key={`${leg.symbol}-${i}`} className="border-b border-border/60">
                <td className="py-1.5 pr-3 text-muted-foreground">
                  {i + 1}. {leg.from} → {leg.to}
                </td>
                <td className="py-1.5 pr-3">{leg.symbol}</td>
                <td className="py-1.5 pr-3 uppercase text-muted-foreground">{leg.side}</td>
                <td className="py-1.5 pr-3">
                  {num(leg.amountIn)} {leg.from}
                </td>
                <td className="py-1.5 pr-3">{num(leg.quoteRate)}</td>
                <td className="py-1.5 pr-3">{leg.execRate ? num(leg.execRate) : "—"}</td>
                <td className="py-1.5 pr-3">
                  {leg.slippagePct === undefined ? (
                    "—"
                  ) : (
                    <span className={leg.slippagePct > 0 ? "text-loss" : "text-profit"}>
                      {pct(-Math.abs(leg.slippagePct), 4)}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-loss">-{leg.feePct}%</td>
                <td className="py-1.5">
                  {num(leg.amountOut)} {leg.to}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Metric label="Capital" value={`${num(opp.capitalStart)} ${opp.startCoin}`} />
        <Metric label="Gross" value={pct(opp.grossRoiPct)} tone={opp.grossRoiPct} />
        <Metric label="Fees" value={pct(-opp.feesPct)} tone={-1} />
        <Metric label="Slippage" value={pct(-opp.slippagePct)} tone={-opp.slippagePct} />
        <Metric label="Net ROI" value={pct(opp.netRoiPct)} tone={opp.netRoiPct} />
        <Metric label="Net profit" value={usd(opp.netProfitUsd)} tone={opp.netProfitUsd} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Metric label="Max fillable notional" value={compactUsd(opp.liquidityUsd)} />
        <Metric label="Assumed fee tier" value={`${opp.legs[0]?.feePct ?? 0}% / leg`} />
        <Metric label="Route category" value={opp.categoryTag} />
      </div>

      {opp.reason && (
        <p className="text-xs text-muted-foreground">
          <span className="term-label">reason</span> {opp.reason}
        </p>
      )}

      <div className="rounded-sm border border-warn/40 bg-warn/5 p-3">
        <p className="term-label mb-2 text-warn">View execution steps — display only</p>
        <ol className="space-y-1 text-xs text-foreground">
          {opp.legs.map((leg, i) => (
            <li key={`step-${i}`}>
              {i + 1}. {leg.side === "sell" ? "SELL" : "BUY"} on {leg.symbol}: spend{" "}
              {num(leg.amountIn)} {leg.from} → receive ≈ {num(leg.amountOut)} {leg.to}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[0.65rem] text-muted-foreground">
          Not automated — this tool never places orders. Verify current prices and depth on Bybit
          before trading manually. Fee rate is an assumed tier, not fetched from your account.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  const cls = tone === undefined ? "" : tone > 0 ? "text-profit" : tone < 0 ? "text-loss" : "";
  return (
    <div className="rounded-sm border border-border bg-background/50 px-2 py-1.5">
      <div className="term-label">{label}</div>
      <div className={`text-sm ${cls}`}>{value}</div>
    </div>
  );
}
