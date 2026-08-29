import { cn } from "@/lib/utils";
import type { OpportunityStatus } from "@/lib/types";

const styles: Record<OpportunityStatus, string> = {
  VERIFIED: "border-profit/50 text-profit bg-profit/10",
  CONDITIONAL: "border-warn/50 text-warn bg-warn/10",
  "NOT PROFITABLE": "border-border text-muted-foreground bg-muted/40",
  "NO LIQUIDITY": "border-loss/50 text-loss bg-loss/10",
  "STALE DATA": "border-info/50 text-info bg-info/10",
  UNVERIFIED: "border-border text-muted-foreground bg-muted/40",
};

export function StatusBadge({
  status,
  className,
}: {
  status: OpportunityStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[0.6rem] tracking-[0.12em]",
        styles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
