"use client";

import { useTheme } from "@/hooks/useTheme";
import { CRISIS_RESOURCES, getMoodTokens } from "./mood-shared";

export function MoodCrisisRail() {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${t.BORDER}`, background: t.HEADER, padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 12 }}>Crisis Resources</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {CRISIS_RESOURCES.map((r) => (
          <div key={r.name} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 2 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: t.ACCENT, fontWeight: 600, marginBottom: 2 }}>{r.number}</div>
            <div style={{ fontSize: 11, color: t.MUTED }}>{r.available}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 16px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}18` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.ACCENT, marginBottom: 8 }}>🔒 Privacy First</div>
        <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.6 }}>Your mood check-in is anonymous and rate-limited per device. We never link submissions to your identity.</div>
      </div>
    </aside>
  );
}
