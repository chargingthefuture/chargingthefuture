"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { fmtCredits, describeMutualCreditFloor, type WalletData } from "./sc-shared";
import { RecentTransactions } from "./sc-transactions-panel";
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens } from './sc-shared';

function BalanceCard({ balance }: { balance: number }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  return (
    <div style={{ marginBottom: 24, padding: "28px 32px", borderRadius: 20, border: `1px solid ${t.ACCENT}30`, background: `linear-gradient(135deg,${t.ACCENT}25 0%,rgba(245,158,11,0.05) 100%)` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Your Balance</div>
      <div style={{ fontSize: 56, fontWeight: 900, color: t.TITLE, lineHeight: 1, marginBottom: 4 }}>
        {fmtCredits(balance)} <span style={{ fontSize: 20, color: t.ACCENT, fontWeight: 700 }}>credits</span>
      </div>
      <div style={{ fontSize: 14, color: t.MUTED }}>usable across all apps</div>
    </div>
  );
}

function StatsRow({ balance, escrow }: { balance: number; escrow: number }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const stats = [
    { l: "Available Balance", v: fmtCredits(balance), c: "#22C55E" },
    { l: "In Escrow", v: fmtCredits(escrow), c: "#EF4444" },
    { l: "Total Balance", v: fmtCredits(balance + escrow), c: t.ACCENT },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
      {stats.map(({ l, v, c }) => (
        <div key={l} style={{ padding: "16px", borderRadius: 12, background: `${c}08`, border: `1px solid ${c}18` }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: c, marginBottom: 4 }}>{v}</div>
          <div style={{ fontSize: 12, color: t.MUTED }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// How far below zero this member may send. The number decides whether a send goes through, so the
// member should not have to bounce a send to find it — and it reads the same here as it does beside
// the mutual-credit option in the send form.
function CreditLineRow({ wallet }: { wallet: WalletData | null }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const available = wallet?.mutualCreditEnabled === true && (wallet?.creditLimit ?? 0) > 0;
  const color = available ? t.ACCENT : t.MUTED;
  return (
    <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: `${color}08`, border: `1px solid ${color}18` }}>
      <div style={{ fontSize: 13, color: available ? t.TITLE : t.MUTED, lineHeight: 1.6 }}>{describeMutualCreditFloor(wallet)}</div>
    </div>
  );
}

export function ServiceCreditsWalletTab({ balance, escrow, wallet }: { balance: number; escrow: number; wallet: WalletData | null }) {
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <BalanceCard balance={balance} />
        <StatsRow balance={balance} escrow={escrow} />
        <CreditLineRow wallet={wallet} />
        <RecentTransactions refreshToken={balance + escrow} />
      </div>
    </ScrollArea>
  );
}
