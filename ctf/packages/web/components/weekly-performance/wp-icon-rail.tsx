"use client";

import { BarChart2 } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { BORDER, BRAND } from "./wp-shared";

// Weekly Performance is a single dashboard view, not a multi-view hub. The old rail filled the
// space below the brand mark with decorative, non-clickable glyphs (a second chart, a trend line,
// a calendar) that went nowhere — they look like buttons but do nothing, which reads as broken.
// Keep the rail minimal: the brand mark, plus the shared footer (back to all apps, account and
// settings, account menu), all of which link somewhere real.
export function WeeklyPerformanceIconRail() {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      {/* Brand mark only — a single chart glyph, not a button. */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <BarChart2 size={20} color={BRAND} />
      </div>

      <PluginRailFooter />
    </aside>
  );
}
