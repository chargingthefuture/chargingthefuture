"use client";

import { BORDER, BRAND, SUBTLE, SURFACE, TEXT, type WpComparison, humanizeMetricKey } from "./wp-shared";

type Row = { metricKey: string; current: number; prev: number };

function buildRows(comparison: WpComparison): Row[] {
  const keys = new Set<string>([
    ...comparison.base.map((m) => m.metricKey),
    ...comparison.compare.map((m) => m.metricKey),
  ]);
  const rows: Row[] = [];
  for (const metricKey of keys) {
    const current = comparison.base.find((m) => m.metricKey === metricKey)?.metricValue ?? 0;
    const prev = comparison.compare.find((m) => m.metricKey === metricKey)?.metricValue ?? 0;
    rows.push({ metricKey, current, prev });
  }
  return rows;
}

// Honest analog of the mockup's "this week vs last week" daily bar chart: the
// data model has no daily breakdown, so this plots each metric's real current
// vs prior value, scaled relative to the max value in view (not a fake 0–100).
export function WeeklyPerformanceComparisonChart({ comparison }: { comparison: WpComparison | null }) {
  if (!comparison) return null;
  const rows = buildRows(comparison);
  if (rows.length === 0) return null;

  const max = Math.max(1, ...rows.map((r) => Math.max(Math.abs(r.current), Math.abs(r.prev))));

  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>This week vs last week</div>
        <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: BRAND }} /><span style={{ color: SUBTLE }}>This week</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} /><span style={{ color: SUBTLE }}>Last week</span></div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 140 }}>
        {rows.map((row) => (
          <div key={row.metricKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
              <div title={`Last week: ${row.prev}`} style={{ width: 16, height: `${(Math.abs(row.prev) / max) * 100}%`, borderRadius: "3px 3px 0 0", background: "rgba(255,255,255,0.12)" }} />
              <div title={`This week: ${row.current}`} style={{ width: 16, height: `${(Math.abs(row.current) / max) * 100}%`, borderRadius: "3px 3px 0 0", background: BRAND }} />
            </div>
            <span style={{ fontSize: 10, color: SUBTLE, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{humanizeMetricKey(row.metricKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
