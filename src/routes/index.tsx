import { createFileRoute } from "@tanstack/react-router";
import { OpportunityTable } from "@/components/OpportunityTable";
import { OpportunityDetail } from "@/components/OpportunityDetail";
import { useScanner } from "@/lib/scanner";
import { pct, time, usd } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arbitrage Dashboard — Bybit Spot Triangular Scanner" },
      {
        name: "description",
        content:
          "Live scan of Bybit public spot pairs, including tokenized stocks, for depth-verified 3-leg triangular arbitrage cycles.",
      },
      { property: "og:title", content: "Arbitrage Dashboard — Bybit Spot Triangular Scanner" },
      {
        property: "og:description",
        content:
          "Depth-verified triangular arbitrage cycles across Bybit spot crypto and xStock pairs.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { opportunities, bestCandidate, stats, settings, scanning, runScan } = useScanner();

  return (
    <div className="space-y-4">
      <section className="term-panel grid grid-cols-2 gap-px overflow-hidden bg-border md:grid-cols-6">
        <Stat label="Assets scanned" value={stats ? String(stats.assetsScanned) : "—"} />
        <Stat label="Symbols" value={stats ? String(stats.symbolsScanned) : "—"} />
        <Stat label="Cycles evaluated" value={stats ? stats.cyclesEvaluated.toLocaleString() : "—"} />
        <Stat label="Depth-verified" value={stats ? String(stats.cyclesVerified) : "—"} />
        <Stat
          label="Scan duration"
          value={stats ? `${(stats.durationMs / 1000).toFixed(2)}s` : "—"}
        />
        <Stat label="Last poll" value={stats ? time(stats.finishedAt) : "—"} />
      </section>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <button
          onClick={runScan}
          disabled={scanning}
          className="rounded-sm border border-primary/60 bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          {scanning ? "SCANNING…" : "RUN SCAN NOW"}
        </button>
        <span>
          mode <span className="text-foreground uppercase">{settings.scanMode}</span> · scanning top{" "}
          {settings.scanMode === "fast" ? Math.min(settings.universeCap, 120) : settings.universeCap}{" "}
          symbols by 24h volume
        </span>
        <span>
          capital <span className="text-foreground">{usd(settings.capitalUsd, 0)}</span> · assumed
          fee <span className="text-foreground">{settings.feePctPerLeg}%/leg</span> (not fetched
          from your account) · min net ROI{" "}
          <span className="text-foreground">{settings.minNetRoiPct}%</span>
        </span>
      </div>

      {opportunities.length > 0 ? (
        <section className="term-panel overflow-hidden">
          <div className="border-b border-border px-3 py-2 term-label">
            Verified opportunities ({opportunities.length}) — click a row for the 3-leg breakdown
          </div>
          <OpportunityTable rows={opportunities} />
        </section>
      ) : (
        <NoResult />
      )}

      {bestCandidate && opportunities.length === 0 && (
        <section className="term-panel overflow-hidden">
          <div className="border-b border-border px-3 py-2 term-label">
            Best candidate breakdown
          </div>
          <OpportunityDetail opp={bestCandidate} />
        </section>
      )}
    </div>
  );
}

function NoResult() {
  const { bestCandidate, stats } = useScanner();
  return (
    <section className="term-panel border-warn/40 p-6">
      <h1 className="text-lg font-bold tracking-[0.18em] text-warn uppercase">
        NO PROFITABLE ARBITRAGE OPPORTUNITY FOUND
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {stats
          ? `${stats.assetsScanned} assets scanned · ${stats.cyclesEvaluated.toLocaleString()} valid cycles evaluated · scan took ${(stats.durationMs / 1000).toFixed(2)}s`
          : "waiting for first scan…"}
      </p>
      {bestCandidate ? (
        <div className="mt-4 space-y-1 text-xs">
          <div>
            <span className="term-label">Best candidate:</span>{" "}
            <span className="text-foreground">{bestCandidate.route.join(" → ")}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <span className="term-label">Gross spread:</span> {pct(bestCandidate.grossRoiPct)}
            </span>
            <span>
              <span className="term-label">Fees:</span> {pct(-bestCandidate.feesPct)}
            </span>
            <span>
              <span className="term-label">Slippage:</span> {pct(-bestCandidate.slippagePct)}
            </span>
            <span>
              <span className="term-label">Net:</span>{" "}
              <span className={bestCandidate.netRoiPct > 0 ? "text-profit" : "text-loss"}>
                {pct(bestCandidate.netRoiPct)}
              </span>
            </span>
          </div>
          <div>
            <span className="term-label">Result:</span>{" "}
            <span className="text-foreground">{bestCandidate.status}</span>
            {bestCandidate.reason ? ` — ${bestCandidate.reason}` : ""}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          No cycle produced a usable quote on the last scan.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-3 py-2">
      <div className="term-label">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}
