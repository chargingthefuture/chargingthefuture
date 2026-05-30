"use client";

import { AlertTriangle, Bell, Clock, FileText, Settings } from "lucide-react";
import { BORDER, BRAND, SUBTLE } from "./clicklog-shared";

// The hub icon-rail chrome. ClickLog is a single-view tool, so the nav glyphs
// are presentational (matching the mockup); the brand mark anchors the rail.
const NAV = [AlertTriangle, Clock, FileText];

export function ClicklogIconRail() {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <AlertTriangle size={20} color={BRAND} />
      </div>
      {NAV.map((Icon, i) => (
        <div key={i} style={{ width: 44, height: 44, borderRadius: 12, background: i === 0 ? `${BRAND}20` : "transparent", border: i === 0 ? `1px solid ${BRAND}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? BRAND : SUBTLE }}>
          <Icon size={20} />
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: SUBTLE }}><Bell size={18} /></div>
      <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: SUBTLE }}><Settings size={18} /></div>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${BRAND}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: BRAND }}>S</div>
    </aside>
  );
}
