"use client";

import { Bell, Heart, Home, KeyRound, MessageCircle, Search, Settings } from "lucide-react";
import { COLOR, type Tab } from "./shared";

const NAV: { icon: React.ElementType; key: Tab; label: string }[] = [
  { icon: Search, key: "browse", label: "Browse" },
  { icon: Heart, key: "matches", label: "Matches" },
  { icon: MessageCircle, key: "chat", label: "Direct Line" },
  { icon: KeyRound, key: "host", label: "List your place" },
];

export function LighthouseIconRail({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Home size={20} style={{ color: COLOR }} />
      </div>
      {NAV.map(({ icon: Icon, key, label }) => (
        <button key={key} aria-label={label} onClick={() => onTab(key)} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
          <Icon size={20} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}><Bell size={18} /></button>
      <button aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}><Settings size={18} /></button>
      <div style={{ width: 36, height: 36, borderRadius: 12, background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
    </aside>
  );
}
