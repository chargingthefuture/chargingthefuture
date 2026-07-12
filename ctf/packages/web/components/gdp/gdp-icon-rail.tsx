"use client";

import { Globe } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { useTheme } from '@/hooks/useTheme';
import { getGdpTokens } from './gdp-shared';

// Left rail on desktop: the plugin logo plus the shared rail footer (back-to-apps and account
// controls). The GDP dashboard is a single view, so there are no tab buttons here.
export function GdpIconRail() {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  return (
    <aside style={{ width: 72, background: t.RAIL, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}30`, border: `1px solid ${t.ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Globe size={20} style={{ color: t.ACCENT }} />
      </div>
      <div style={{ flex: 1 }} />
      <PluginRailFooter />
    </aside>
  );
}
