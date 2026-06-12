"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, BarChart2, Settings, Smile } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getMoodTokens, type Tab } from "./mood-shared";

const NAV: { icon: React.ElementType; key: Tab }[] = [
  { icon: Smile, key: "checkin" },
  { icon: BarChart2, key: "community" },
];

export function MoodIconRail({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  return (
    <aside style={{ width: 72, background: t.RAIL, borderRight: `1px solid ${t.BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}30`, border: `1px solid ${t.ACCENT}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Smile size={20} style={{ color: t.ACCENT }} />
      </div>
      {NAV.map(({ icon: Icon, key }) => (
        <button key={key} type="button" onClick={() => onTab(key)} aria-label={key === "checkin" ? "Check-in" : "Community Pulse"} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${t.ACCENT}20` : "transparent", border: tab === key ? `1px solid ${t.ACCENT}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? t.ACCENT : t.SUBTLE }}>
          <Icon size={20} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button type="button" aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.SUBTLE }}><Bell size={18} /></button>
      <button type="button" aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.SUBTLE }}><Settings size={18} /></button>
      <Avatar style={{ width: 36, height: 36 }}>
        <AvatarFallback style={{ background: `${t.ACCENT}30`, color: t.ACCENT, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
      </Avatar>
    </aside>
  );
}
