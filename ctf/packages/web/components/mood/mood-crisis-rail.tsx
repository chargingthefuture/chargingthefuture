"use client";

import { COLOR, CRISIS_RESOURCES, SUBTLE } from "./mood-shared";

export function MoodCrisisRail() {
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: SUBTLE, textTransform: "uppercase", marginBottom: 12 }}>Crisis Resources</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {CRISIS_RESOURCES.map((r) => (
          <div key={r.name} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F9FAFB", marginBottom: 2 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: COLOR, fontWeight: 600, marginBottom: 2 }}>{r.number}</div>
            <div style={{ fontSize: 11, color: SUBTLE }}>{r.available}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}18` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, marginBottom: 8 }}>🔒 Privacy First</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>Your mood check-in is anonymous and rate-limited per device. We never link submissions to your identity.</div>
      </div>
    </aside>
  );
}
