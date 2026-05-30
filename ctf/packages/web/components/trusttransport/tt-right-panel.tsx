"use client";

import { Shield, Phone, CheckCircle, Zap } from "lucide-react";
import { COLOR } from "./tt-shared";

const SAFETY_FEATURES = [
  { icon: Shield, l: "Background Checked", v: "All drivers", c: "#22C55E" },
  { icon: Phone, l: "Emergency SOS", v: "One-tap alert", c: "#EF4444" },
  { icon: CheckCircle, l: "Identity Verified", v: "Photo ID required", c: COLOR },
  { icon: Zap, l: "Real-time Tracking", v: "End-to-end encrypted", c: "#38BDF8" },
];

export function TrustTransportRightPanel({
  requestCount,
  modeCount,
  onBook,
}: {
  requestCount: number;
  modeCount: number;
  onBook: () => void;
}) {
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Safety Features</div>
      {SAFETY_FEATURES.map(({ icon: Icon, l, v, c }) => (
        <div key={l} style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px", borderRadius: 10, background: `${c}08`, border: `1px solid ${c}20`, marginBottom: 8 }}>
          <Icon size={16} style={{ color: c, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>{l}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{v}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Platform Stats</div>
        {[{ l: "My Requests", v: String(requestCount) }, { l: "Transport Modes", v: String(modeCount) }].map(({ l, v }) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", color: "#6B7280" }}>
            <span>{l}</span>
            <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onBook} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        + Book a Ride
      </button>
    </aside>
  );
}
