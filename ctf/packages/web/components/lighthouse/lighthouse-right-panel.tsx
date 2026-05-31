"use client";

import { Eye, Shield } from "lucide-react";
import { COLOR } from "./shared";

const PRICING: { range: string; l: string; c: string }[] = [
  { range: "$500–800", l: "Emergency/Studio", c: "#22C55E" },
  { range: "$800–1,200", l: "1 Bedroom", c: COLOR },
  { range: "$1,200+", l: "2+ Bedrooms", c: "#6B7280" },
];

export function LighthouseRightPanel() {
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Emergency Housing</div>
      <div style={{ padding: "14px 16px", borderRadius: 12, background: "#EF444410", border: "1px solid #EF444430", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Shield size={14} style={{ color: "#EF4444" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Immediate placement</span>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>If you need housing right now, reach out through the chat — emergency placements are confidential and prioritized.</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Pricing Guide</div>
      {PRICING.map(({ range, l, c }) => (
        <div key={range} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{range}</div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>{l}</div>
        </div>
      ))}
      <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Eye size={12} style={{ color: COLOR }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Privacy by Design</span>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Your location is never exposed to landlords without your consent. All matches are end-to-end encrypted.</div>
      </div>
    </aside>
  );
}
