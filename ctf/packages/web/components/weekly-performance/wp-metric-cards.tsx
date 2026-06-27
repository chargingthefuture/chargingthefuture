"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { BRAND, SUBTLE, SURFACE, type WpComparison, type WpMetric, formatDelta, formatMetricValue, humanizeMetricKey } from "./wp-shared";

const CARD_COLORS = ["#A78BFA", "#22C55E", BRAND, "#06B6D4", "#EC4899", "#F97316"];

// delta = current − prior, joined by metricKey from the comparison payload.
function deltaFor(comparison: WpComparison | null, metricKey: string): number | null {
  if (!comparison) return null;
  const current = comparison.base.find((m) => m.metricKey === metricKey);
  const prior = comparison.compare.find((m) => m.metricKey === metricKey);
  if (!current || !prior) return null;
  return current.metricValue - prior.metricValue;
}

export function WeeklyPerformanceMetricCards({
  metrics,
  comparison,
}: {
  metrics: WpMetric[];
  comparison: WpComparison | null;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
      {metrics.map((metric, i) => {
        const color = CARD_COLORS[i % CARD_COLORS.length];
        const delta = deltaFor(comparison, metric.metricKey);
        const positive = (delta ?? 0) >= 0;
        return (
          <div key={metric.metricKey} style={{ padding: "18px 16px", borderRadius: 14, background: SURFACE, border: `1px solid ${color}20` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: SUBTLE }}>{humanizeMetricKey(metric.metricKey)}</span>
              <TrendingUp size={14} color={color} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>{formatMetricValue(metric.metricValue, metric.metricUnit)}</div>
            {delta !== null ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: positive ? "#22C55E" : "#F87171" }}>
                {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {formatDelta(delta, metric.metricUnit)}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: SUBTLE }}>No prior-week comparison</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
