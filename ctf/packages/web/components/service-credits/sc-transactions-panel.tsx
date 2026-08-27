"use client";

// The wallet's "Recent Transactions" panel: one page of the member's own ledger history, read from
// the authoritative ledger via GET /api/service-credits/transactions.
//
// The list is paged, not endlessly scrolled. A long-standing member can have hundreds of ledger
// rows, and rendering all of them made the wallet screen grow without a bottom — the balance and
// the send form scrolled far out of reach. Each request now asks for one page (PAGE_SIZE rows at a
// given offset) and the response carries the member's total row count, so the pager can show
// "Page N of M" and the panel keeps a fixed height whatever the history length.
import { useCallback, useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { fmtCredits, describeLedgerEntry, getServiceCreditsTokens, type LedgerEntry } from "./sc-shared";
import { ServiceCreditsPager } from "./sc-pager";
import { useTheme } from "@/hooks/useTheme";

const PAGE_SIZE = 10;

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

type PageState = { entries: LedgerEntry[]; total: number };

// Fetches one page of ledger rows. Kept apart from the component so the fetch, the paging state, and
// the rendering stay separate responsibilities.
async function fetchTransactionPage(page: number): Promise<PageState> {
  const query = `limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
  const res = await fetch(`/api/service-credits/transactions?${query}`);
  if (!res.ok) {
    throw new Error(`Failed to load transactions (${res.status}).`);
  }
  const data = (await res.json()) as { entries?: LedgerEntry[]; total?: number };
  const entries = Array.isArray(data.entries) ? data.entries : [];
  // An older response without a total still pages sensibly: assume this is the last page.
  const total = typeof data.total === "number" && Number.isFinite(data.total) ? data.total : page * PAGE_SIZE + entries.length;
  return { entries, total };
}

// Reads the member's ledger a page at a time. Re-reads whenever the balance changes, so a fresh
// transfer or grant shows up without a manual reload; that reset returns to the first page, where
// the new row is. Renders loading / error / empty / populated states so the panel always reflects
// real data rather than a static placeholder.
export function RecentTransactions({ refreshToken }: { refreshToken: number }) {
  const [page, setPage] = useState(0);
  const [state, setState] = useState<PageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A new balance means new history: go back to the newest page rather than staying on an offset
  // that has since shifted by a row.
  useEffect(() => {
    setPage(0);
  }, [refreshToken]);

  useEffect(() => {
    let active = true;
    setError(null);
    setLoading(true);
    fetchTransactionPage(page)
      .then((next) => {
        if (active) setState(next);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Failed to load transactions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, refreshToken]);

  const pageCount = state ? Math.max(Math.ceil(state.total / PAGE_SIZE), 1) : 1;
  const onPageChange = useCallback(
    (next: number) => {
      setPage(Math.min(Math.max(next, 0), pageCount - 1));
    },
    [pageCount],
  );

  if (error) {
    return (
      <TransactionsShell>
        <CenteredState>{error}</CenteredState>
      </TransactionsShell>
    );
  }

  if (state === null) {
    return (
      <TransactionsShell>
        <CenteredState muted>Loading transactions…</CenteredState>
      </TransactionsShell>
    );
  }

  if (state.total === 0) {
    return (
      <TransactionsShell>
        <CenteredState>Your transaction history will appear here as you earn and spend credits.</CenteredState>
      </TransactionsShell>
    );
  }

  return (
    <TransactionsShell>
      <TransactionsList entries={state.entries} />
      <ServiceCreditsPager
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        summary={`${fmtCredits(state.total)} ${state.total === 1 ? "transaction" : "transactions"}`}
        busy={loading}
      />
    </TransactionsShell>
  );
}
