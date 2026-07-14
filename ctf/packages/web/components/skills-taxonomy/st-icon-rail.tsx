"use client";

import { Layers } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { RefreshButton } from "@/components/shared/refresh-button";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsTaxonomyTokens } from "./st-shared";

// Skills Taxonomy is a single browser view, not a multi-view hub. The old rail repeated the Layers
// mark (brand + first nav item) and filled the rest with decorative, non-clickable glyphs
// (Briefcase/Award/Bell/Settings) and a static "S" avatar — which reads as broken. Keep it minimal:
// the brand mark, plus the shared footer (back to all apps, account and settings, account menu).
export function SkillsTaxonomyIconRail({ onRefresh }: { onRefresh?: () => void | Promise<void> } = {}) {
  const { theme } = useTheme();
  const t = getSkillsTaxonomyTokens(theme);
  return (
    <aside style={{ width: 72, background: t.RAIL, borderRight: `1px solid ${t.BORDER_SOLID}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      {/* Brand mark only — a single Layers glyph, not a button. */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}25`, border: `1px solid ${t.ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <Layers size={20} color={t.ACCENT} />
      </div>

      {/* The desktop browser has no header bar, so the rail carries the refresh control. */}
      {onRefresh ? <RefreshButton onRefresh={onRefresh} title="Refresh" /> : null}

      <PluginRailFooter />
    </aside>
  );
}
