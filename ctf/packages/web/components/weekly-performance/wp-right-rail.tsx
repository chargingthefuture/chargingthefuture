"use client";

import { BarChart2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getWeeklyPerformanceTokens, type WpWeek, formatWeekRange } from "./wp-shared";

export function WeeklyPerformanceRightRail({
  week,
  metricCount,
  activeUsersLast7Days,
  isCurrent = false,
}: {
  week: WpWeek | null;
  metricCount: number;
  activeUsersLast7Days: number | null;
  isCurrent?: boolean;
}) {
  const { theme } = useTheme();
  const t = getWeeklyPerformanceTokens(theme);
  const rows: { k: string; v: string }[] = [];
  if (week) {
    // The current week is live; past weeks are historical and carry no status — there is no
    // "closed" week.
    if (isCurrent) {
      rows.push({ k: "Status", v: "Live" });
    }
    rows.push({ k: "Metrics tracked", v: String(metricCount) });
  }
  if (activeUsersLast7Days !== null) {
    rows.push({ k: "Active users (7d)", v: activeUsersLast7Days.toLocaleString() });
  }

  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${t.BORDER_SOLID}`, background: t.HEADER, padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>Week Summary</div>
      <div style={{ padding: "16px", borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <BarChart2 size={14} color={t.ACCENT} />
          <span style={{ fontSize: 13, fontWeight: 600, color: t.ACCENT }}>{week ? formatWeekRange(week) : "No week selected"}</span>
        </div>
        {rows.map(({ k, v }) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: t.MUTED }}>{k}</span>
            <span style={{ color: t.TITLE, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
