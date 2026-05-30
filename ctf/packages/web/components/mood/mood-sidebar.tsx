"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock } from "lucide-react";
import { COLOR, SUBTLE, TEXT, type Tab } from "./mood-shared";

const TABS: { key: Tab; label: string }[] = [
  { key: "checkin", label: "Check-in" },
  { key: "community", label: "Community Pulse" },
];

export function MoodSidebar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: SUBTLE, textTransform: "uppercase", marginBottom: 12 }}>😁 Mood</div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Lock size={12} style={{ color: COLOR }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>100% Anonymous</span>
          </div>
          <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6 }}>Your mood is never linked to your identity. Encrypted and rate-limited per device.</div>
        </div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {TABS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => onTab(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: tab === key ? `${COLOR}18` : "transparent", borderLeft: tab === key ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", width: "calc(100% - 4px)", textAlign: "left" }}>
              <span style={{ fontSize: 13, color: tab === key ? TEXT : "#9CA3AF", flex: 1 }}>{label}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
