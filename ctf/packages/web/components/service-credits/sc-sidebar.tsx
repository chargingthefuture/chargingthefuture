"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

// Section labels mirror the design. These are descriptive labels, not controls
// (real navigation lives in the icon rail), so they carry no pointer/click
// affordance. Per the real-data-only rule the design's hardcoded "Platform
// Stats" (142M issued / 89M circulating / avg balance) are omitted — there is
// no aggregate-stats route to back them.
const NAV = ["My Wallet", "Transaction History", "Earn Credits", "Spend Credits", "Peer Transfer"];

export function ServiceCreditsSidebar() {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>ServiceCredits</div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {NAV.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: "#9CA3AF", flex: 1 }}>{f}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
