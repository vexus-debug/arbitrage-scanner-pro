import { cn } from "@/lib/utils";
import type { Opportunity } from "@/lib/types";

export function RouteLabel({ route, className }: { route: string[]; className?: string }) {
  return (
    <span className={cn("whitespace-nowrap text-foreground", className)}>
      {route.join(" \u2192 ")}
    </span>
  );
}

export function CategoryTag({ tag }: { tag: Opportunity["categoryTag"] }) {
  return (
    <span
      className={cn(
        "rounded-sm border px-1 py-0.5 text-[0.55rem] tracking-[0.12em] uppercase",
        tag === "xstock"
          ? "border-info/50 text-info"
          : tag === "mixed"
            ? "border-warn/50 text-warn"
            : "border-border text-muted-foreground",
      )}
    >
      {tag}
    </span>
  );
}
