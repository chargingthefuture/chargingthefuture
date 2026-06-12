"use client";

import { Coins } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COLOR, fmtCredits } from "./sc-shared";

function BalanceCard({ balance }: { balance: number }) {
  return (
    <div style={{ marginBottom: 24, padding: "28px 32px", borderRadius: 20, border: `1px solid ${COLOR}30`, background: `linear-gradient(135deg,${COLOR}25 0%,rgba(245,158,11,0.05) 100%)` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Your Balance</div>
      <div style={{ fontSize: 56, fontWeight: 900, color: "#F9FAFB", lineHeight: 1, marginBottom: 4 }}>
        {fmtCredits(balance)} <span style={{ fontSize: 20, color: COLOR, fontWeight: 700 }}>credits</span>
      </div>
      <div style={{ fontSize: 14, color: "#6B7280" }}>usable across all apps</div>
    </div>
  );
}

function StatsRow({ balance, escrow }: { balance: number; escrow: number }) {
  const stats = [
    { l: "Available Balance", v: fmtCredits(balance), c: "#22C55E" },
    { l: "In Escrow", v: fmtCredits(escrow), c: "#EF4444" },
    { l: "Total Balance", v: fmtCredits(balance + escrow), c: COLOR },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
      {stats.map(({ l, v, c }) => (
        <div key={l} style={{ padding: "16px", borderRadius: 12, background: `${c}08`, border: `1px solid ${c}18` }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: c, marginBottom: 4 }}>{v}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function TransactionsEmpty() {
  return (
    <div style={{ padding: "40px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB", marginBottom: 16, alignSelf: "flex-start" }}>Recent Transactions</div>
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Coins size={20} style={{ color: "rgba(245,158,11,0.4)" }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>No transactions yet</div>
      <div style={{ fontSize: 13, color: "#4B5563", textAlign: "center" }}>Your transaction history will appear here as you earn and spend credits.</div>
    </div>
  );
}

export function ServiceCreditsWalletTab({ balance, escrow }: { balance: number; escrow: number }) {
  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: "24px" }}>
        <BalanceCard balance={balance} />
        <StatsRow balance={balance} escrow={escrow} />
        <TransactionsEmpty />
      </div>
    </ScrollArea>
  );
}
