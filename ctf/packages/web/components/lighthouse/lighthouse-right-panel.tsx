"use client";

import { COLOR } from "./shared";

const PRICING: { range: string; l: string; c: string }[] = [
  { range: "$500–800", l: "Emergency/Studio", c: "#22C55E" },
  { range: "$800–1,200", l: "1 Bedroom", c: COLOR },
  { range: "$1,200+", l: "2+ Bedrooms", c: "#6B7280" },
];

export function LighthouseRightPanel() {
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Pricing Guide</div>
      {PRICING.map(({ range, l, c }) => (
        <div key={range} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{range}</div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>{l}</div>
        </div>
      ))}
    </aside>
  );
}
