"use client";

import { MessageCircle, Plus, Radio, Share2 } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { SUBTLE, type Tab } from "./sr-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSocketRelayTokens } from './sr-shared';

// The three tabs are real controls. Fixes: the brand mark used the same Share2 glyph as the Feed tab
// (so it showed twice) — it's now a distinct Radio (relay) mark; the dead Bell/Settings buttons
// (no destination) are removed; and the shared footer below carries the account menu.
const NAV: { icon: React.ElementType; key: Tab; label: string }[] = [
  { icon: Share2, key: "feed", label: "Feed" },
  { icon: Plus, key: "post", label: "Post" },
  { icon: MessageCircle, key: "chat", label: "Direct Line" },
];

export function SocketRelayIconRail({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  return (
    <aside style={{ width: 72, background: t.RAIL, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}30`, border: `1px solid ${t.ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <Radio size={20} style={{ color: t.ACCENT }} />
      </div>
      {NAV.map(({ icon: Icon, key, label }) => (
        <button key={key} onClick={() => onTab(key)} aria-label={label} title={label} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${t.ACCENT}20` : "transparent", border: tab === key ? `1px solid ${t.ACCENT}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? t.ACCENT : SUBTLE }}>
          <Icon size={20} />
        </button>
      ))}
      <PluginRailFooter />
    </aside>
  );
}
