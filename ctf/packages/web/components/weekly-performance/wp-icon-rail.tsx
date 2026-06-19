"use client";

import { BarChart2, Calendar, TrendingUp } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { BORDER, BRAND, SUBTLE } from "./wp-shared";

// Hub icon-rail chrome. Weekly Performance is a single dashboard view, so the
// nav glyphs are presentational (matching the mockup); the brand mark anchors it.
const NAV = [BarChart2, TrendingUp, Calendar];

export function WeeklyPerformanceIconRail() {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <BarChart2 size={20} color={BRAND} />
      </div>
      {NAV.map((Icon, i) => (
        <div key={i} style={{ width: 44, height: 44, borderRadius: 12, background: i === 0 ? `${BRAND}20` : "transparent", border: i === 0 ? `1px solid ${BRAND}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? BRAND : SUBTLE }}>
          <Icon size={20} />
        </div>
      ))}
      <PluginRailFooter />
    </aside>
  );
}
