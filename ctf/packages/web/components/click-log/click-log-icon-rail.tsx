"use client";

import { AlertTriangle } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { useTheme } from "@/hooks/useTheme";
import { getClickLogTokens } from "./click-log-shared";

// ClickLog is a single-view tool, not a multi-view hub. The old rail filled the space below the
// brand mark with decorative, non-clickable glyphs (a clock, a document) that went nowhere — they
// look like buttons but do nothing, which reads as broken. Keep the rail minimal: the brand mark,
// plus the shared footer (back to all apps, account and settings, account menu), all of which link
// somewhere real.
export function ClickLogIconRail() {
  const { theme } = useTheme();
  const t = getClickLogTokens(theme);
  return (
    <aside style={{ width: 72, background: t.RAIL, borderRight: `1px solid ${t.BORDER_SOLID}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      {/* Brand mark only — a single alert glyph, not a button. */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}25`, border: `1px solid ${t.ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <AlertTriangle size={20} color={t.ACCENT} />
      </div>

      <PluginRailFooter />
    </aside>
  );
}
