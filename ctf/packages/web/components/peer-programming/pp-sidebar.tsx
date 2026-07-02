"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

const HOW_IT_WORKS = ["12 survivors per cohort", "Weekly 90-min sessions", "Deterministic placement", "Global, always-open"];

export function PeerProgrammingSidebar() {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase" }}>PeerProgramming</div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          <div style={{ margin: "4px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>How It Works</div>
          {HOW_IT_WORKS.map((l) => (
            <div key={l} style={{ padding: "5px 10px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>• {l}</div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
