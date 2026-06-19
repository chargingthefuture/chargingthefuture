"use client";

import { Wallet, TrendingUp, BarChart3 } from "lucide-react";
import { Coins } from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { COLOR, type Tab } from "./sc-shared";

// Every glyph here is a real control. The Coins brand mark sits at the top once (the Wallet tab uses
// a distinct Wallet icon so the coin no longer appears twice) and the three tabs switch the view. The
// shared footer below adds the go-back, account, and account-menu controls. The old decorative
// Bell/Settings (no destination) and the chat-styled "Info" tab were removed.
const TABS: { icon: React.ElementType; key: Tab; label: string }[] = [
  { icon: Wallet, key: "wallet", label: "Wallet" },
  { icon: TrendingUp, key: "earn", label: "Earn" },
  { icon: BarChart3, key: "economy", label: "Economy" },
];

const railBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

export function ServiceCreditsIconRail({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }} aria-hidden="true">
        <Coins size={20} style={{ color: COLOR }} />
      </div>
      {TABS.map(({ icon: Icon, key, label }) => (
        <button key={key} type="button" aria-label={label} aria-current={tab === key ? "page" : undefined} onClick={() => onTab(key)}
          style={{ ...railBtn, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", color: tab === key ? COLOR : "#6B7280" }}>
          <Icon size={20} />
        </button>
      ))}
      <PluginRailFooter />
    </aside>
  );
}
