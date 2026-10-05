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
//
// A goal row is a stored weekly snapshot, and a week that was never captured reports 0 rather than
// a reading. A delta against that 0 would show the entire total as this week's rise, so a goal
// with no prior snapshot reports no delta and the card says so.
function deltaFor(comparison: WpComparison | null, metricKey: string, isGoal: boolean): number | null {
  if (!comparison) return null;
  const current = comparison.base.find((m) => m.metricKey === metricKey);
  const prior = comparison.compare.find((m) => m.metricKey === metricKey);
  if (!current || !prior) return null;
  if (isGoal && prior.metricValue === 0) return null;
  return current.metricValue - prior.metricValue;
}

// Compact big-number label for goal targets/progress (300B, 2M) — goal scales are far beyond
// what a plain locale string reads well at.
function compactNumber(value: number): string {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

// How to draw a week-over-week delta. The arrow follows the direction the number moved; the color
// follows whether that direction is good for this metric — almost everything here is better when it
// rises, but more deleted accounts is a rise and is not good news. No change is neither: it gets the
// muted color and no arrow, for every metric.
function deltaTone(delta: number, metricKey: string, mutedColor: string): { arrow: "up" | "down" | null; color: string } {
  if (delta === 0) return { arrow: null, color: mutedColor };
  const rising = delta > 0;
  const good = isRiseGoodFor(metricKey) ? rising : !rising;
  return { arrow: rising ? "up" : "down", color: good ? "#22C55E" : "#F87171" };
}

function MetricCard({
  metric,
  color,
  comparison,
  isCurrent,
}: {
  metric: WpMetric;
  color: string;
  comparison: WpComparison | null;
  isCurrent: boolean;
}) {
  const { theme } = useTheme();
  const t = getTokens(theme);
  const goalTarget = GOAL_TARGETS[metric.metricKey];
  // A past week with no stored goal snapshot reports 0 rather than a reading (see goalMetricForWeek
  // and the registry's wp_goal_* entries). Showing that 0 with a progress bar reads as a real reading
  // of nothing, so the card says it was not captured instead. The current week is always a live read.
  const notCaptured = goalTarget !== undefined && !isCurrent && metric.metricValue === 0;
  const delta = notCaptured ? null : deltaFor(comparison, metric.metricKey, goalTarget !== undefined);
  const tone = deltaTone(delta ?? 0, metric.metricKey, t.MUTED);
  // Goal rows show progress toward the owner-set target. Progress can be tiny early on; show two
  // decimals so movement is visible instead of rounding to 0%.
  const progress = goalTarget && !notCaptured ? Math.min(100, (metric.metricValue / goalTarget) * 100) : null;
  return (
    <div style={{ padding: "18px 16px", borderRadius: 14, background: t.SURFACE, border: `1px solid ${color}20` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: t.MUTED }}>{humanizeMetricKey(metric.metricKey)}</span>
        {goalTarget ? <Target size={14} color={color} /> : <TrendingUp size={14} color={color} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>
        {notCaptured ? "Not captured" : goalTarget ? compactNumber(metric.metricValue) : formatMetricValue(metric.metricValue, metric.metricUnit)}
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
          {tone.arrow === "up" ? <TrendingUp size={11} /> : tone.arrow === "down" ? <TrendingDown size={11} /> : null} {formatDelta(delta, metric.metricUnit)}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: t.MUTED }}>
          {notCaptured ? "No snapshot was stored for this week" : goalTarget ? "No prior-week snapshot" : "No prior-week comparison"}
        </div>
      )}
    </div>
  );
}

const getTokens = getWeeklyPerformanceTokens;

export function WeeklyPerformanceMetricCards({
  metrics,
  comparison,
  isCurrent = false,
}: {
  metrics: WpMetric[];
  comparison: WpComparison | null;
  isCurrent?: boolean;
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
                return <MetricCard key={metric.metricKey} metric={metric} color={color} comparison={comparison} isCurrent={isCurrent} />;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
