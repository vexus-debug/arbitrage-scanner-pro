export const pct = (v: number, digits = 4) =>
  `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;

export const usd = (v: number, digits = 2) =>
  `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

export const num = (v: number) => {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  if (abs >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (abs >= 1) return v.toFixed(4);
  return v.toPrecision(6);
};

export const compactUsd = (v: number | null) => {
  if (v === null || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
};

export const time = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
