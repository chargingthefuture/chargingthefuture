"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, MessageSquare, Plus, Settings, Share2 } from "lucide-react";
import { COLOR, SUBTLE, type Tab } from "./sr-shared";

const NAV: { icon: React.ElementType; key: Tab; label: string }[] = [
  { icon: Share2, key: "feed", label: "Feed" },
  { icon: Plus, key: "post", label: "Post" },
  { icon: MessageSquare, key: "chat", label: "Chat" },
];

export function SocketRelayIconRail({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Share2 size={20} style={{ color: COLOR }} />
      </div>
      {NAV.map(({ icon: Icon, key, label }) => (
        <button key={key} onClick={() => onTab(key)} aria-label={label} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : SUBTLE }}>
          <Icon size={20} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: SUBTLE }}><Bell size={18} /></button>
      <button aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: SUBTLE }}><Settings size={18} /></button>
      <Avatar style={{ width: 36, height: 36 }}>
        <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
      </Avatar>
    </aside>
  );
}
