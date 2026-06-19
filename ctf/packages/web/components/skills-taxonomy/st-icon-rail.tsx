"use client";

import { Layers } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { BORDER, BRAND } from "./st-shared";

// Skills Taxonomy is a single browser view, not a multi-view hub. The old rail repeated the Layers
// mark (brand + first nav item) and filled the rest with decorative, non-clickable glyphs
// (Briefcase/Award/Bell/Settings) and a static "S" avatar — which reads as broken. Keep it minimal:
// the brand mark, plus the shared footer (back to all apps, account and settings, account menu).
export function SkillsTaxonomyIconRail() {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      {/* Brand mark only — a single Layers glyph, not a button. */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <Layers size={20} color={BRAND} />
      </div>

      <PluginRailFooter />
    </aside>
  );
}
