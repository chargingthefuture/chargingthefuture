"use client";

import { Shield } from "lucide-react";
import { SUBTLE } from "./sr-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSocketRelayTokens } from './sr-shared';

export function SocketRelayRightPanel({
  openCount,
  myRequestCount,
  fulfillmentCount,
  totalCount,
  onPost,
}: {
  openCount: number;
  myRequestCount: number;
  fulfillmentCount: number;
  totalCount: number;
  onPost: () => void;
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  const cards = [
    { l: "Open Requests", v: String(openCount), c: t.ACCENT },
    { l: "My Requests", v: String(myRequestCount), c: "#22C55E" },
    { l: "My Fulfillments", v: String(fulfillmentCount), c: "#A855F7" },
    { l: "Total Requests", v: String(totalCount), c: "#F59E0B" },
  ];
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: t.HEADER, padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>Impact</div>
      {cards.map(({ l, v, c }) => (
        <div key={l} style={{ padding: "14px 16px", borderRadius: 12, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div>
          <div style={{ fontSize: 12, color: SUBTLE }}>{l}</div>
        </div>
      ))}
      <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Shield size={12} style={{ color: t.ACCENT }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: t.ACCENT }}>Good to know</span>
        </div>
        <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6 }}>SocketRelay is a peer-to-peer community board — members connect and arrange help directly. Take the usual precautions before transacting with anyone you don't know: meet in public, and don't send money or share personal details until you're comfortable.</div>
      </div>
      <button onClick={onPost} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        + Post a Request
      </button>
    </aside>
  );
}
