"use client";

import { Search, Bell } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { COLOR, TABS, type Tab } from "./sh-shared";

export function SkillsHuntIconRail({
  tab,
  onTab,
  notifOpen,
  onToggleNotif,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  notifOpen: boolean;
  onToggleNotif: () => void;
}) {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Search size={20} style={{ color: COLOR }} />
      </div>
      {TABS.map(({ key, icon: Icon, label }) => (
        <button key={key} type="button" aria-label={label} aria-current={tab === key ? "page" : undefined} onClick={() => onTab(key)}
          style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
          <Icon size={20} />
        </button>
      ))}
      <button type="button" aria-label="Status" aria-expanded={notifOpen} onClick={onToggleNotif}
        style={{ width: 44, height: 44, borderRadius: 12, background: notifOpen ? `${COLOR}20` : "transparent", border: notifOpen ? `1px solid ${COLOR}40` : "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: notifOpen ? COLOR : "#6B7280" }}>
        <Bell size={18} />
      </button>
      <PluginRailFooter />
    </aside>
  );
}
