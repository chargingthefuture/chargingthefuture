"use client";

import { Target, TrendingDown, TrendingUp } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { GOAL_TARGETS } from "@/lib/weekly-performance/goal-constants";
import {
  METRIC_GROUP_HEADINGS,
  type WpComparison,
  type WpMetric,
  type WpMetricGroup,
  formatDelta,
  formatMetricValue,
  getWeeklyPerformanceTokens,
  humanizeMetricKey,
  isRiseGoodFor,
  metricGroup,
} from "./wp-shared";

// Data-series palette (one color per metric card) — kept raw like every chart palette.
const CARD_COLORS = ["#A78BFA", "#22C55E", "#6366F1", "#06B6D4", "#EC4899", "#F97316"];

// delta = current − prior, joined by metricKey from the comparison payload.
function deltaFor(comparison: WpComparison | null, metricKey: string): number | null {
  if (!comparison) return null;
  const current = comparison.base.find((m) => m.metricKey === metricKey);
  const prior = comparison.compare.find((m) => m.metricKey === metricKey);
  if (!current || !prior) return null;
  return current.metricValue - prior.metricValue;
}

// Compact big-number label for goal targets/progress (300B, 2M) — goal scales are far beyond
// what a plain locale string reads well at.
function compactNumber(value: number): string {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

// How to draw a week-over-week delta. The arrow follows the direction the number moved; the color
// follows whether that direction is good for this metric — almost everything here is better when it
// rises, but more deleted accounts is a rise and is not good news.
function deltaTone(delta: number, metricKey: string): { rising: boolean; color: string } {
  const rising = delta >= 0;
  const good = isRiseGoodFor(metricKey) ? rising : !rising;
  return { rising, color: good ? "#22C55E" : "#F87171" };
}

function MetricCard({
  metric,
  color,
  comparison,
}: {
  metric: WpMetric;
  color: string;
  comparison: WpComparison | null;
}) {
  const { theme } = useTheme();
  const t = getTokens(theme);
  const delta = deltaFor(comparison, metric.metricKey);
  const tone = deltaTone(delta ?? 0, metric.metricKey);
  const goalTarget = GOAL_TARGETS[metric.metricKey];
  // Goal rows show progress toward the owner-set target. Progress can be tiny early on; show two
  // decimals so movement is visible instead of rounding to 0%.
  const progress = goalTarget ? Math.min(100, (metric.metricValue / goalTarget) * 100) : null;
  return (
    <div style={{ padding: "18px 16px", borderRadius: 14, background: t.SURFACE, border: `1px solid ${color}20` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: t.MUTED }}>{humanizeMetricKey(metric.metricKey)}</span>
        {goalTarget ? <Target size={14} color={color} /> : <TrendingUp size={14} color={color} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>
        {goalTarget ? compactNumber(metric.metricValue) : formatMetricValue(metric.metricValue, metric.metricUnit)}
      </div>
      {goalTarget && progress !== null ? (
        <div style={{ marginBottom: 6 }}>
          <div style={{ height: 6, borderRadius: 3, background: `${color}22`, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ width: `${Math.max(progress, 0.5)}%`, minWidth: 2, height: "100%", background: color }} />
          </div>
          <div style={{ fontSize: 11, color: t.MUTED }}>
            {progress.toLocaleString(undefined, { maximumFractionDigits: 2 })}% of the {compactNumber(goalTarget)} goal
          </div>
        </div>
      ) : null}
      {delta !== null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: tone.color }}>
          {tone.rising ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {formatDelta(delta, metric.metricUnit)}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: t.MUTED }}>No prior-week comparison</div>
      )}
    </div>
  );
}

const getTokens = getWeeklyPerformanceTokens;

export function WeeklyPerformanceMetricCards({
  metrics,
  comparison,
}: {
  metrics: WpMetric[];
  comparison: WpComparison | null;
}) {
  const { theme } = useTheme();
  const t = getTokens(theme);
  const groups: WpMetricGroup[] = ["goal", "value", "adoption", "other"];
  let colorIndex = 0;
  return (
    <div style={{ marginBottom: 24 }}>
      {groups.map((group) => {
        const groupMetrics = metrics.filter((m) => metricGroup(m.metricKey) === group);
        if (groupMetrics.length === 0) return null;
        return (
          <section key={group} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.MUTED, margin: "0 0 10px" }}>
              {METRIC_GROUP_HEADINGS[group]}
            </h3>
            <div
              style={{
                display: "grid",
                // Goal cards are the headline pair — give them room; the rest tile compactly.
                gridTemplateColumns: group === "goal" ? "repeat(auto-fit, minmax(260px, 1fr))" : "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {groupMetrics.map((metric) => {
                const color = CARD_COLORS[colorIndex % CARD_COLORS.length];
                colorIndex += 1;
                return <MetricCard key={metric.metricKey} metric={metric} color={color} comparison={comparison} />;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
