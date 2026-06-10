"use client";

import { Shield } from "lucide-react";
import { COLOR, SUBTLE } from "./sr-shared";

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
  const cards = [
    { l: "Open Requests", v: String(openCount), c: COLOR },
    { l: "My Requests", v: String(myRequestCount), c: "#22C55E" },
    { l: "My Fulfillments", v: String(fulfillmentCount), c: "#A855F7" },
    { l: "Total Requests", v: String(totalCount), c: "#F59E0B" },
  ];
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Impact</div>
      {cards.map(({ l, v, c }) => (
        <div key={l} style={{ padding: "14px 16px", borderRadius: 12, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div>
          <div style={{ fontSize: 12, color: SUBTLE }}>{l}</div>
        </div>
      ))}
      <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Shield size={12} style={{ color: COLOR }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Privacy Minimized</span>
        </div>
        <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6 }}>Public requests never include identifying information.</div>
      </div>
      <button onClick={onPost} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        + Post a Request
      </button>
    </aside>
  );
}
