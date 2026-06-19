"use client";

import { Car, Navigation, MessageCircle, Bell, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { COLOR, type Tab } from "./tt-shared";

const TABS: { icon: React.ElementType; key: Tab; label: string }[] = [
  { icon: Car, key: "book", label: "Book a ride" },
  { icon: Navigation, key: "tracking", label: "Tracking" },
  { icon: MessageCircle, key: "chat", label: "Direct Line" },
];

export function TrustTransportIconRail({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Car size={20} style={{ color: COLOR }} />
      </div>
      {TABS.map(({ icon: Icon, key, label }) => (
        <button key={key} type="button" aria-label={label} title={label} aria-current={tab === key ? "page" : undefined} onClick={() => onTab(key)} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
          <Icon size={20} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button type="button" aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
        <Bell size={18} />
      </button>
      <button type="button" aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
        <Settings size={18} />
      </button>
      <Avatar style={{ width: 36, height: 36 }}>
        <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
      </Avatar>
    </aside>
  );
}
