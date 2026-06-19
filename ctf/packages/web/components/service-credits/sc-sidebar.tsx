"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { COLOR, type Tab } from "./sc-shared";

// Real secondary navigation: each row switches the main view (the same tabs the icon rail drives),
// so every item is clickable. The earlier list was decorative-only labels with no click affordance,
// and named views that did not exist (Transaction History lives inside My Wallet; transfers happen in
// the always-visible Send panel), which is why nothing happened on click.
const NAV: { key: Tab; label: string }[] = [
  { key: "wallet", label: "My Wallet" },
  { key: "earn", label: "Earn & Spend" },
  { key: "economy", label: "The Economy" },
];

export function ServiceCreditsSidebar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>ServiceCredits</div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {NAV.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTab(item.key)}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px",
                  borderRadius: 8, marginLeft: 2, marginBottom: 2, cursor: "pointer", textAlign: "left",
                  background: active ? `${COLOR}1A` : "transparent",
                  border: `1px solid ${active ? COLOR + "33" : "transparent"}`,
                  color: active ? COLOR : "#9CA3AF",
                  fontSize: 13, fontWeight: active ? 600 : 500,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
