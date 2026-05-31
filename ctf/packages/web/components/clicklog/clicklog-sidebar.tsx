"use client";

import { BORDER, BRAND, FAINT, SUBTLE, SURFACE, WEEKDAYS } from "./clicklog-shared";

export function ClicklogSidebar({ total, weekdayCounts }: { total: number; weekdayCounts: number[] }) {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: SUBTLE, textTransform: "uppercase", marginBottom: 4 }}>🚨 ClickLog</div>
        <div style={{ fontSize: 12, color: FAINT, lineHeight: 1.5 }}>Personal incident counter — private &amp; encrypted</div>
      </div>
      <div style={{ padding: "0 12px", flex: 1 }}>
        <div style={{ padding: "16px", borderRadius: 14, background: `${BRAND}08`, border: `1px solid ${BRAND}18`, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 4 }}>Total Logged</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: BRAND }}>{total}</div>
          <div style={{ fontSize: 11, color: SUBTLE, marginTop: 4 }}>incidents · all time</div>
        </div>
        <div style={{ padding: "12px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 8 }}>This week</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            {WEEKDAYS.map((d, i) => {
              const count = weekdayCounts[i] ?? 0;
              const active = count > 0;
              return (
                <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: active ? `${BRAND}25` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? BRAND + "40" : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: active ? BRAND : SUBTLE }}>
                    {active ? String(count) : ""}
                  </div>
                  <span style={{ fontSize: 8, color: SUBTLE }}>{d[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, color: FAINT, lineHeight: 1.5 }}>🔒 All data is end-to-end encrypted. Only you can see your incidents.</div>
      </div>
    </aside>
  );
}
