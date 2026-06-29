"use client";

import { BarChart2, Lock } from "lucide-react";
import { BORDER, BRAND, SUBTLE, TEXT, type WpWeek, formatWeekRange } from "./wp-shared";

export function WeeklyPerformanceRightRail({
  week,
  metricCount,
  activeUsersLast7Days,
  isAdmin,
  isCurrent = false,
}: {
  week: WpWeek | null;
  metricCount: number;
  activeUsersLast7Days: number | null;
  isAdmin: boolean;
  isCurrent?: boolean;
}) {
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
    <aside style={{ width: 280, borderLeft: `1px solid ${BORDER}`, background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Week Summary</div>
      <div style={{ padding: "16px", borderRadius: 14, background: `${BRAND}08`, border: `1px solid ${BRAND}20`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <BarChart2 size={14} color={BRAND} />
          <span style={{ fontSize: 13, fontWeight: 600, color: BRAND }}>{week ? formatWeekRange(week) : "No week selected"}</span>
        </div>
        {rows.map(({ k, v }) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: SUBTLE }}>{k}</span>
            <span style={{ color: TEXT, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
      {!isAdmin && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Lock size={13} color={SUBTLE} />
          <span style={{ fontSize: 11, color: SUBTLE }}>Export available to admins</span>
        </div>
      )}
    </aside>
  );
}
