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

type WpTokens = ReturnType<typeof getWeeklyPerformanceTokens>;

// Goal rows show progress toward the owner-set target. Progress can be tiny early on; show two
// decimals so movement is visible instead of rounding to 0%.
function goalProgress(metricValue: number, goalTarget: number | undefined, notCaptured: boolean): number | null {
  if (!goalTarget || notCaptured) return null;
  return Math.min(100, (metricValue / goalTarget) * 100);
}

function metricHeadline(metric: WpMetric, goalTarget: number | undefined, notCaptured: boolean): string {
  if (notCaptured) return "Not captured";
  if (goalTarget) return compactNumber(metric.metricValue);
  return formatMetricValue(metric.metricValue, metric.metricUnit);
}

function noDeltaLabel(goalTarget: number | undefined, notCaptured: boolean): string {
  if (notCaptured) return "No snapshot was stored for this week";
  return goalTarget ? "No prior-week snapshot" : "No prior-week comparison";
}

function GoalProgressBar({ progress, goalTarget, color, t }: { progress: number; goalTarget: number; color: string; t: WpTokens }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ height: 6, borderRadius: 3, background: `${color}22`, overflow: "hidden", marginBottom: 5 }}>
        <div style={{ width: `${Math.max(progress, 0.5)}%`, minWidth: 2, height: "100%", background: color }} />
      </div>
      <div style={{ fontSize: 11, color: t.MUTED }}>
        {progress.toLocaleString(undefined, { maximumFractionDigits: 2 })}% of the {compactNumber(goalTarget)} goal
      </div>
    </div>
  );
}

function DeltaLine({ delta, metric, t }: { delta: number; metric: WpMetric; t: WpTokens }) {
  const tone = deltaTone(delta, metric.metricKey, t.MUTED);
  let arrow = null;
  if (tone.arrow === "up") arrow = <TrendingUp size={11} />;
  else if (tone.arrow === "down") arrow = <TrendingDown size={11} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: tone.color }}>
      {arrow} {formatDelta(delta, metric.metricUnit)}
    </div>
  );
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
  const progress = goalProgress(metric.metricValue, goalTarget, notCaptured);
  return (
    <div style={{ padding: "18px 16px", borderRadius: 14, background: t.SURFACE, border: `1px solid ${color}20` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: t.MUTED }}>{humanizeMetricKey(metric.metricKey)}</span>
        {goalTarget ? <Target size={14} color={color} /> : <TrendingUp size={14} color={color} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>
        {metricHeadline(metric, goalTarget, notCaptured)}
      </div>
      {goalTarget && progress !== null ? <GoalProgressBar progress={progress} goalTarget={goalTarget} color={color} t={t} /> : null}
      {delta !== null ? (
        <DeltaLine delta={delta} metric={metric} t={t} />
      ) : (
        <div style={{ fontSize: 11, color: t.MUTED }}>{noDeltaLabel(goalTarget, notCaptured)}</div>
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
