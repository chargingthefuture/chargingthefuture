"use client";

import { type WpComparison, type WpMetric, type WpWeek } from "./wp-shared";
import { WeeklyPerformanceMetricCards } from "./wp-metric-cards";
import { WeeklyPerformanceComparisonChart } from "./wp-comparison-chart";
import { WeeklyPerformanceEmptyMain } from "./wp-empty-main";

export function WeeklyPerformanceDashboardMain({
  week,
  metrics,
  comparison,
  isCurrent = false,
}: {
  week: WpWeek | null;
  metrics: WpMetric[];
  comparison: WpComparison | null;
  onRefresh: () => Promise<void>;
  isMobile?: boolean;
  isCurrent?: boolean;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
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
