"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fmtCredits, describeLedgerEntry, describeMutualCreditFloor, type LedgerEntry, type WalletData } from "./sc-shared";
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

function SectionHeading() {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  return <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE, marginBottom: 16 }}>Recent Transactions</div>;
}

function TransactionsShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <SectionHeading />
      {children}
    </div>
  );
}

function CenteredState({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Coins size={20} style={{ color: "rgba(245,158,11,0.4)" }} />
      </div>
      <div style={{ fontSize: 13, color: muted ? t.MUTED : t.SUBTLE, textAlign: "center" }}>{children}</div>
    </div>
  );
}

function amountStyle(direction: "in" | "out" | "neutral"): { sign: string; color: string } {
  if (direction === "in") return { sign: "+", color: "#22C55E" };
  if (direction === "out") return { sign: "−", color: "#EF4444" };
  return { sign: "", color: "#9CA3AF" };
}

function TransactionRow({ entry }: { entry: LedgerEntry }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const { label, direction } = describeLedgerEntry(entry.entryType, entry.referenceType);
  const { sign, color } = amountStyle(direction);
  const when = new Date(entry.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE }}>{label}</div>
        <div style={{ fontSize: 12, color: t.MUTED }}>{when}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color, whiteSpace: "nowrap" }}>
        {sign}{fmtCredits(entry.amount)} <span style={{ fontSize: 11, color: t.MUTED, fontWeight: 600 }}>credits</span>
      </div>
    </div>
  );
}

function TransactionsList({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div>
      {entries.map((entry) => (
        <TransactionRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

// Recent wallet history, read from the authoritative ledger via GET /api/service-credits/transactions.
// Fetches on mount (and whenever the balance changes, so a fresh transfer/grant shows up without a
// manual reload). Renders loading / error / empty / populated states so the panel always reflects
// real data rather than a static placeholder.
function RecentTransactions({ refreshToken }: { refreshToken: number }) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    fetch("/api/service-credits/transactions")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load transactions (${res.status}).`);
        return (await res.json()) as { entries?: LedgerEntry[] };
      })
      .then((data) => {
        if (active) setEntries(Array.isArray(data.entries) ? data.entries : []);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Failed to load transactions.");
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  if (error) {
    return (
      <TransactionsShell>
        <CenteredState>{error}</CenteredState>
      </TransactionsShell>
    );
  }

  if (entries === null) {
    return (
      <TransactionsShell>
        <CenteredState muted>Loading transactions…</CenteredState>
      </TransactionsShell>
    );
  }

  if (entries.length === 0) {
    return (
      <TransactionsShell>
        <CenteredState>Your transaction history will appear here as you earn and spend credits.</CenteredState>
      </TransactionsShell>
    );
  }

  return (
    <TransactionsShell>
      <TransactionsList entries={entries} />
    </TransactionsShell>
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
