"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { COLOR, SIDEBAR_FILTERS, type GdpMetrics } from "./gdp-shared";

function LiveTicker({ metrics }: { metrics: GdpMetrics }) {
  const rows = [
    { l: "Target", v: metrics.target },
    { l: "Progress", v: metrics.progress },
    { l: "Countries", v: metrics.countries },
    { l: "Members", v: metrics.members },
  ].filter(({ v }) => Boolean(v));
  return (
    <>
      <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>Live Ticker</div>
      <div style={{ padding: "12px", margin: "0 8px 8px", borderRadius: 10, background: `${COLOR}08`, border: `1px solid ${COLOR}15` }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: COLOR }}>{metrics.currentValue}</div>
        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Current TI Skills Economy</div>
        {metrics.delta ? <div style={{ fontSize: 12, color: "#22C55E" }}>{metrics.delta}</div> : null}
      </div>
      {rows.map(({ l, v }) => (
        <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: "#6B7280" }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
      ))}
    </>
  );
}

export function GdpSidebar({ metrics }: { metrics: GdpMetrics }) {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>GDP Tracker</div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {SIDEBAR_FILTERS.map((f, i) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
            </div>
          ))}
          {metrics.currentValue ? <LiveTicker metrics={metrics} /> : null}
        </div>
      </ScrollArea>
    </aside>
  );
}
