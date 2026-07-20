"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/hooks/useTheme";
import { getPeerProgrammingTokens } from "./pp-shared";

const HOW_IT_WORKS = ["Up to 12 people per cohort", "Weekly 90-min sessions", "Deterministic placement", "Global, always-open"];

export function PeerProgrammingSidebar() {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: `1px solid ${t.BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase" }}>PeerProgramming</div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          <div style={{ margin: "4px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", padding: "0 10px" }}>How It Works</div>
          {HOW_IT_WORKS.map((l) => (
            <div key={l} style={{ padding: "5px 10px", fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>• {l}</div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
