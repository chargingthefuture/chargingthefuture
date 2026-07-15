"use client";

import { Heart, Home, KeyRound, MessageCircle, Search, UserRound } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { useTheme } from "@/hooks/useTheme";
import { getLighthouseTokens, type Tab } from "./shared";

const NAV: { icon: React.ElementType; key: Tab; label: string }[] = [
  { icon: Search, key: "browse", label: "Browse" },
  { icon: Heart, key: "matches", label: "Matches" },
  { icon: MessageCircle, key: "chat", label: "Direct Line" },
  { icon: UserRound, key: "profile", label: "Your details" },
  { icon: KeyRound, key: "host", label: "List your place" },
];

export function LighthouseIconRail({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <aside style={{ width: 72, background: t.RAIL, borderRight: `1px solid ${t.BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}30`, border: `1px solid ${t.ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Home size={20} style={{ color: t.ACCENT }} />
      </div>
      {NAV.map(({ icon: Icon, key, label }) => (
        <button key={key} aria-label={label} onClick={() => onTab(key)} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${t.ACCENT}20` : "transparent", border: tab === key ? `1px solid ${t.ACCENT}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? t.ACCENT : t.MUTED }}>
          <Icon size={20} />
        </button>
      ))}
      <PluginRailFooter />
    </aside>
  );
}
