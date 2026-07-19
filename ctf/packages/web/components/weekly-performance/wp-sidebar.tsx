"use client";

import { useTheme } from "@/hooks/useTheme";
import { getWeeklyPerformanceTokens, type WpWeek, formatWeekRange, isCurrentWeek } from "./wp-shared";

export function WeeklyPerformanceSidebar({
  weeks,
  selectedWeekStart,
  currentWeekStart,
  onSelect,
}: {
  weeks: WpWeek[];
  selectedWeekStart: string | null;
  currentWeekStart: string | null;
  onSelect: (weekStartDate: string) => void;
}) {
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: `1px solid ${t.BORDER_SOLID}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 4 }}>📊 Weekly Performance</div>
        <div style={{ fontSize: 12, color: t.FAINT, lineHeight: 1.5 }}>Week-over-week platform metrics</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#374151", textTransform: "uppercase", padding: "4px 10px 8px" }}>Week History</div>
        {weeks.length === 0 ? (
          <div style={{ padding: "8px 10px", fontSize: 12, color: t.MUTED }}>No weeks tracked yet.</div>
        ) : (
          weeks.map((week) => {
            const selected = week.weekStartDate === selectedWeekStart;
            const current = isCurrentWeek(week.weekStartDate, currentWeekStart);
            return (
              <button key={week.weekStartDate} onClick={() => onSelect(week.weekStartDate)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, cursor: "pointer", background: selected ? `${t.ACCENT}18` : "transparent", borderLeft: selected ? `2px solid ${t.ACCENT}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", textAlign: "left" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: selected ? t.TITLE : t.SUBTLE, fontWeight: selected ? 600 : 400 }}>{formatWeekRange(week)}</div>
                </div>
                {/* Only the current week is live; past weeks are historical and carry no pill. */}
                {current && (
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: `${t.ACCENT}20`, color: t.ACCENT, fontWeight: 600 }}>LIVE</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
