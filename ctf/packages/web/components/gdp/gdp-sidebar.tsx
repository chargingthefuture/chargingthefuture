"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { GDP_ESTIMATE_CHIP_LABEL, SIDEBAR_FILTERS, type GdpMetrics } from "./gdp-shared";
import { useTheme } from '@/hooks/useTheme';
import { getGdpTokens } from './gdp-shared';

function LiveTicker({ metrics }: { metrics: GdpMetrics }) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  const isEstimate = metrics.isEstimate === true;
  const rows = [
    { l: "Target", v: metrics.target },
    { l: "Progress", v: metrics.progress },
    { l: "Countries", v: metrics.countries },
    { l: "Members", v: metrics.members },
  ].filter(({ v }) => Boolean(v));
  return (
    <>
      <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", padding: "0 10px" }}>Live Ticker</div>
      <div style={{ padding: "12px", margin: "0 8px 8px", borderRadius: 10, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}15` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: t.ACCENT }}>{metrics.currentValue}</div>
          {isEstimate ? (
            <span style={{ display: "inline-flex", alignItems: "center", fontSize: 9, fontWeight: 600, color: t.MUTED, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>{GDP_ESTIMATE_CHIP_LABEL}</span>
          ) : null}
        </div>
        <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 4 }}>Current TI Skills Economy</div>
        {metrics.delta ? <div style={{ fontSize: 12, color: "#22C55E" }}>{metrics.delta}</div> : null}
      </div>
      {rows.map(({ l, v }) => (
        <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: t.MUTED }}>{l}: <span style={{ color: t.ACCENT, fontWeight: 600 }}>{v}</span></div>
      ))}
    </>
  );
}

export function GdpSidebar({ metrics }: { metrics: GdpMetrics }) {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 12 }}>GDP Tracker</div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {SIDEBAR_FILTERS.map((f, i) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "default", background: i === 0 ? `${t.ACCENT}18` : "transparent", borderLeft: i === 0 ? `2px solid ${t.ACCENT}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: i === 0 ? t.TEXT : t.SUBTLE, flex: 1 }}>{f}</span>
            </div>
          ))}
          {metrics.currentValue ? <LiveTicker metrics={metrics} /> : null}
        </div>
      </ScrollArea>
    </aside>
  );
}
