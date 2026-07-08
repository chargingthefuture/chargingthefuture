"use client";

import { useTheme } from "@/hooks/useTheme";
import { getClickLogTokens, WEEKDAYS } from "./click-log-shared";

export function ClickLogSidebar({ total, weekdayCounts }: { total: number; weekdayCounts: number[] }) {
  const { theme } = useTheme();
  const t = getClickLogTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: `1px solid ${t.BORDER_SOLID}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 4 }}>🚨 ClickLog</div>
        <div style={{ fontSize: 12, color: t.FAINT, lineHeight: 1.5 }}>Personal incident counter — private</div>
      </div>
      <div style={{ padding: "0 12px", flex: 1 }}>
        <div style={{ padding: "16px", borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}18`, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 4 }}>Total Logged</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: t.ACCENT }}>{total}</div>
          <div style={{ fontSize: 11, color: t.MUTED, marginTop: 4 }}>incidents · all time</div>
        </div>
        <div style={{ padding: "12px", borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>This week</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            {WEEKDAYS.map((d, i) => {
              const count = weekdayCounts[i] ?? 0;
              const active = count > 0;
              return (
                <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: active ? `${t.ACCENT}25` : t.INPUT_BG, border: `1px solid ${active ? t.ACCENT + "40" : t.BORDER_SOLID}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: active ? t.ACCENT : t.MUTED }}>
                    {active ? String(count) : ""}
                  </div>
                  <span style={{ fontSize: 8, color: t.MUTED }}>{d[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${t.BORDER_SOLID}` }}>
        <div style={{ fontSize: 11, color: t.FAINT, lineHeight: 1.5 }}>🔒 Only you can see your incidents.</div>
      </div>
    </aside>
  );
}
