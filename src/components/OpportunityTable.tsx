import { useState } from "react";
import { OpportunityDetail } from "./OpportunityDetail";
import { CategoryTag, RouteLabel } from "./RouteTag";
import { StatusBadge } from "./StatusBadge";
import { compactUsd, pct, usd } from "@/lib/format";
import type { Opportunity } from "@/lib/types";

export function OpportunityTable({ rows }: { rows: Opportunity[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-xs">
        <thead>
          <tr className="term-label border-b border-border text-left">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Route</th>
            <th className="px-3 py-2 text-right">Capital</th>
            <th className="px-3 py-2 text-right">Gross ROI</th>
            <th className="px-3 py-2 text-right">Fees</th>
            <th className="px-3 py-2 text-right">Slippage</th>
            <th className="px-3 py-2 text-right">Net ROI</th>
            <th className="px-3 py-2 text-right">Net profit</th>
            <th className="px-3 py-2 text-right">Liquidity</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <>
              <tr
                key={row.id}
                onClick={() => setOpen(open === row.id ? null : row.id)}
                className="cursor-pointer border-b border-border/60 hover:bg-accent/40"
              >
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <RouteLabel route={row.route} />
                    <CategoryTag tag={row.categoryTag} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right">{usd(row.capitalUsd, 0)}</td>
                <td className="px-3 py-2 text-right">{pct(row.grossRoiPct)}</td>
                <td className="px-3 py-2 text-right text-loss">{pct(-row.feesPct)}</td>
                <td className="px-3 py-2 text-right text-loss">{pct(-row.slippagePct)}</td>
                <td
                  className={`px-3 py-2 text-right ${row.netRoiPct > 0 ? "text-profit" : "text-loss"}`}
                >
                  {pct(row.netRoiPct)}
                </td>
                <td
                  className={`px-3 py-2 text-right ${row.netProfitUsd > 0 ? "text-profit" : "text-loss"}`}
                >
                  {usd(row.netProfitUsd)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {compactUsd(row.liquidityUsd)}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
              {open === row.id && (
                <tr key={`${row.id}-detail`}>
                  <td colSpan={10} className="p-0">
                    <OpportunityDetail opp={row} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
