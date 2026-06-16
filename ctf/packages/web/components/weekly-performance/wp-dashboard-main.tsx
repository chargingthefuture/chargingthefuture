"use client";

import { BarChart2, CheckCircle, Download } from "lucide-react";
import { BORDER, BRAND, SUBTLE, TEXT, type WpComparison, type WpMetric, type WpWeek, formatWeekRange, isLiveWeek } from "./wp-shared";
import { WeeklyPerformanceMetricCards } from "./wp-metric-cards";
import { WeeklyPerformanceComparisonChart } from "./wp-comparison-chart";
import { WeeklyPerformanceEmptyMain } from "./wp-empty-main";

export function WeeklyPerformanceDashboardMain({
  week,
  metrics,
  comparison,
  isAdmin,
  onExport,
  isMobile = false,
}: {
  week: WpWeek | null;
  metrics: WpMetric[];
  comparison: WpComparison | null;
  isAdmin: boolean;
  onExport: () => void;
  isMobile?: boolean;
}) {
  const live = isLiveWeek(week);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* The phone shell already renders the title, the week selector, and an Export
          button in its own sticky header, so this desktop header is redundant — and
          its fixed flex row squeezes the title on a narrow screen. Show it on desktop
          only; the "In Progress / Closed" status reads from the empty state on phones. */}
      {!isMobile && (
        <header style={{ height: 56, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <BarChart2 size={18} color={BRAND} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{week ? `Week of ${formatWeekRange(week)}` : "Weekly Performance"}</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Non-financial platform metrics</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: live ? `${BRAND}15` : "rgba(255,255,255,0.05)", border: `1px solid ${live ? BRAND + "40" : BORDER}`, fontSize: 11, fontWeight: 600, color: live ? BRAND : SUBTLE }}>
            {live ? "● In Progress" : <><CheckCircle size={11} /> Closed</>}
          </div>
          {isAdmin && week && (
            <button onClick={onExport} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, color: BRAND, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Download size={14} /> Export
            </button>
          )}
        </header>
      )}

      {metrics.length === 0 ? (
        <WeeklyPerformanceEmptyMain week={week} />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <WeeklyPerformanceMetricCards metrics={metrics} comparison={comparison} />
          <WeeklyPerformanceComparisonChart comparison={comparison} />
        </div>
      )}
    </div>
  );
}
