"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { COLOR } from "./sc-shared";
import { EARN_METHODS, SPEND_OPTIONS } from "./service-credits.constants";

// Static program guide describing real earn/spend mechanics across plugins.
// The design's per-row "Start →" button is omitted — it has no backing action
// here (each program lives in its own plugin), so we show the reward only
// rather than a non-functional button.
export function ServiceCreditsEarnTab() {
  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Earn ServiceCredits</div>
        <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Contribute to the community and get rewarded</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {EARN_METHODS.map((m) => (
            <div key={m.title} style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${m.color}25`, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>{m.title}</div>
                <Badge style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}30`, fontSize: 11 }}>{m.difficulty}</Badge>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>{m.credits}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 12 }}>Where to Spend</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {SPEND_OPTIONS.map((s) => (
            <div key={s.title} style={{ padding: "16px", borderRadius: 14, background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EAF0", marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.credits}</div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
