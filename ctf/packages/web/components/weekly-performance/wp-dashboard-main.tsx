"use client";

import { BarChart2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getWeeklyPerformanceTokens, type WpComparison, type WpMetric, type WpWeek, formatWeekRange } from "./wp-shared";
import { WeeklyPerformanceMetricCards } from "./wp-metric-cards";
import { WeeklyPerformanceComparisonChart } from "./wp-comparison-chart";
import { WeeklyPerformanceEmptyMain } from "./wp-empty-main";
import { RefreshButton } from "@/components/shared/refresh-button";

export function WeeklyPerformanceDashboardMain({
  week,
  metrics,
  comparison,
  onRefresh,
  isMobile = false,
  isCurrent = false,
}: {
  week: WpWeek | null;
  metrics: WpMetric[];
  comparison: WpComparison | null;
  onRefresh: () => Promise<void>;
  isMobile?: boolean;
  isCurrent?: boolean;
}) {
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
      {/* The phone shell already renders the title and the week selector in its own sticky
          header, so this desktop header is redundant — and its fixed flex row squeezes the
          title on a narrow screen. Show it on desktop only. */}
      {!isMobile && (
        <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
          <BarChart2 size={18} color={t.ACCENT} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.TITLE }}>{week ? `Week of ${formatWeekRange(week)}` : "Weekly Performance"}</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Non-financial platform metrics</div>
          </div>
          {/* The current week is live (its numbers are still moving); past weeks are settled
              historical windows and carry no badge — there is no "closed" state. */}
          {isCurrent && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}40`, fontSize: 11, fontWeight: 600, color: t.ACCENT }}>
              ● Live
            </div>
          )}
          <RefreshButton onRefresh={onRefresh} title="Refresh" />
        </header>
      )}

      {metrics.length === 0 ? (
        <WeeklyPerformanceEmptyMain week={week} isCurrent={isCurrent} />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "24px" }}>
          <WeeklyPerformanceMetricCards metrics={metrics} comparison={comparison} />
          <WeeklyPerformanceComparisonChart comparison={comparison} />
        </div>
      )}
    </div>
  );
}
