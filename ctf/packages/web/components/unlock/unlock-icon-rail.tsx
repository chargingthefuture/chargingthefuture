"use client";

import { Unlock as UnlockIcon } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { BORDER, BRAND } from "./unlock-shared";

// Unlock is a gate, not a multi-view hub. The old rail mimicked the main hub chrome with decorative
// glyphs that did nothing (and repeated the lock mark), which reads as broken. Keep it deliberately
// minimal: one brand mark, plus the shared footer (back to all apps, account and settings, account
// menu) that every plugin rail carries.
export function UnlockIconRail() {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      {/* Brand mark only — a single lock, not a button. */}
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <UnlockIcon size={20} color={BRAND} />
      </div>

      <PluginRailFooter />
    </aside>
  );
}
