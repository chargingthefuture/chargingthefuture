"use client";

import { Car, MapPin, Navigation, MessageCircle, HandHeart, Wallet } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens, type Tab } from "./tt-shared";

// The book tab uses a distinct MapPin glyph so the Car no longer appears twice (brand mark + tab).
const TABS: { icon: React.ElementType; key: Tab; label: string }[] = [
  { icon: MapPin, key: "book", label: "Book a ride" },
  { icon: Navigation, key: "tracking", label: "Tracking" },
  { icon: HandHeart, key: "help", label: "Help out" },
  { icon: Wallet, key: "earnings", label: "Earnings" },
  { icon: MessageCircle, key: "chat", label: "Direct Line" },
];

export function TrustTransportIconRail({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <aside style={{ width: 72, background: t.RAIL, borderRight: `1px solid ${t.BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}30`, border: `1px solid ${t.ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Car size={20} style={{ color: t.ACCENT }} />
      </div>
      {TABS.map(({ icon: Icon, key, label }) => (
        <button key={key} type="button" aria-label={label} title={label} aria-current={tab === key ? "page" : undefined} onClick={() => onTab(key)} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${t.ACCENT}20` : "transparent", border: tab === key ? `1px solid ${t.ACCENT}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? t.ACCENT : t.MUTED }}>
          <Icon size={20} />
        </button>
      ))}
      <PluginRailFooter />
    </aside>
  );
}
