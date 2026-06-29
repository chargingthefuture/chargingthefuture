"use client";

// Empty main-column content when the selected week has no metrics yet.
// Ported from design/.../survivor-hub/WeeklyPerformanceEmpty.tsx (chrome lives
// in the dashboard; this is the inner placeholder).
import { BarChart2, Clock } from "lucide-react";
import { BORDER, BRAND, SUBTLE, SURFACE, TEXT, type WpWeek, formatWeekRange } from "./wp-shared";

export function WeeklyPerformanceEmptyMain({ week, isCurrent = false }: { week: WpWeek | null; isCurrent?: boolean }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "40px 48px" }}>
      <div style={{ padding: "28px 32px", borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 32 }}>
        <div style={{ textAlign: "center", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: `${BRAND}10`, border: `1px dashed ${BRAND}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart2 size={28} style={{ color: BRAND, opacity: 0.4 }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>
            {isCurrent ? "Weekly numbers are loading" : "No activity recorded for this week"}
          </div>
          <div style={{ fontSize: 13, color: SUBTLE, maxWidth: 440, lineHeight: 1.6 }}>
            {isCurrent
              ? "Numbers update live as members use the platform this week. They'll appear here in a moment."
              : "No member activity was recorded during this week."}
          </div>
          {week && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
              <Clock size={14} color={SUBTLE} />
              <span style={{ fontSize: 12, color: SUBTLE }}>Week: {formatWeekRange(week)}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, opacity: 0.15 }}>
          {[50, 65, 45, 75, 80, 55, 30].map((h, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "80%", height: `${h}%`, borderRadius: "3px 3px 0 0", background: BRAND }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
