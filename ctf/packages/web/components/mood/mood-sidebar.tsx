"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getMoodTokens, type Tab } from "./mood-shared";

const TABS: { key: Tab; label: string }[] = [
  { key: "checkin", label: "Check-in" },
  { key: "community", label: "Community Pulse" },
];

export function MoodSidebar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: `1px solid ${t.BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 12 }}>😁 Mood</div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Lock size={12} style={{ color: t.ACCENT }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: t.ACCENT }}>Pseudonymous</span>
          </div>
          <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>Your check-ins are stored under a random ID kept separate from your account, and never shown to anyone. One check-in per week.</div>
        </div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {TABS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => onTab(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: tab === key ? `${t.ACCENT}18` : "transparent", borderLeft: tab === key ? `2px solid ${t.ACCENT}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", width: "calc(100% - 4px)", textAlign: "left" }}>
              <span style={{ fontSize: 13, color: tab === key ? t.TEXT : t.SUBTLE, flex: 1 }}>{label}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
