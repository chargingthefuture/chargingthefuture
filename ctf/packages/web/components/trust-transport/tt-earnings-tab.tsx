"use client";

import { useEffect, useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens, type TtPayout } from "./tt-shared";

interface CurrencyBalance {
  currency: string;
  balance: number;
}

function payoutStatusLabel(s: string | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function payoutStatusColor(s: string | undefined): string {
  if (s === "paid" || s === "approved") return "#22C55E";
  if (s === "rejected") return "#EF4444";
  return "#F59E0B"; // requested / pending
}

export function TrustTransportEarningsTab() {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<CurrencyBalance[]>([]);
  const [payouts, setPayouts] = useState<TtPayout[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [balRes, payRes] = await Promise.all([
        fetch("/api/trust-transport/earnings"),
        fetch("/api/trust-transport/payouts"),
      ]);
      if (!balRes.ok || !payRes.ok) throw new Error("Could not load your earnings.");
      const balData = (await balRes.json()) as { balances?: CurrencyBalance[] };
      const payData = (await payRes.json()) as { items?: TtPayout[] };
      const nextBalances = Array.isArray(balData.balances) ? balData.balances : [];
      setBalances(nextBalances);
      setPayouts(Array.isArray(payData.items) ? payData.items : []);
      setSelectedCurrency((prev) => prev && nextBalances.some((b) => b.currency === prev) ? prev : (nextBalances[0]?.currency ?? null));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load your earnings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selectedBalance = balances.find((b) => b.currency === selectedCurrency)?.balance ?? 0;

  async function requestPayout() {
    if (!selectedCurrency) return;
    const parsed = Number(amount);
    if (!(Number.isFinite(parsed) && parsed > 0)) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (parsed > selectedBalance) {
      setFormError(`That's more than your available ${selectedCurrency} balance.`);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/trust-transport/payouts/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ amount: parsed, currency: selectedCurrency }),
      });
      if (!res.ok) throw new Error("Could not submit your payout request.");
      setRequested(true);
      setAmount("");
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Could not submit your payout request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ flex: 1, padding: "24px", overflowY: "auto", minHeight: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 6 }}>Earnings</div>
      <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 20, lineHeight: 1.5, maxWidth: 520 }}>
        ServiceCredits you earn are paid straight to your ServiceCredits wallet when a trip completes. This tab tracks other-currency earnings and your payout requests, which an admin reviews.
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.MUTED, fontSize: 13 }}>
          <Loader2 size={16} className="animate-spin" /> Loading earnings…
        </div>
      ) : error ? (
        <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: t.SUBTLE, marginBottom: 12 }}>Available balance</div>
          {balances.length === 0 ? (
            <div style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}`, marginBottom: 20, color: t.MUTED, fontSize: 13 }}>
              No withdrawable earnings yet. Fiat/crypto earnings from completed trips show up here.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              {balances.map((b) => (
                <button
                  key={b.currency}
                  type="button"
                  onClick={() => setSelectedCurrency(b.currency)}
                  style={{ minWidth: 140, textAlign: "left", padding: "16px 18px", borderRadius: 16, background: selectedCurrency === b.currency ? `${t.ACCENT}14` : "rgba(255,255,255,0.02)", border: `1px solid ${selectedCurrency === b.currency ? t.ACCENT + "40" : t.BORDER_STRONG}`, cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Wallet size={16} style={{ color: t.ACCENT }} />
                    <div style={{ fontSize: 12, color: t.SUBTLE }}>{b.currency}</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: t.TITLE }}>{b.balance}</div>
                </button>
              ))}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: t.SUBTLE, marginBottom: 12 }}>Request a payout</div>
          {requested && <div style={{ fontSize: 13, color: t.ACCENT, fontWeight: 600, marginBottom: 10 }}>Payout requested. You&apos;ll see it below with its status.</div>}
          {balances.length === 0 ? (
            <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>You can request a payout once you have a withdrawable balance.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, maxWidth: 460, alignItems: "center" }}>
                <select value={selectedCurrency ?? ""} onChange={(e) => setSelectedCurrency(e.target.value)} style={{ padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.BORDER_HI}`, color: t.TEXT, fontSize: 14 }}>
                  {balances.map((b) => <option key={b.currency} value={b.currency}>{b.currency}</option>)}
                </select>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Amount (max ${selectedBalance})`} style={{ flex: 1, padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.BORDER_HI}`, color: t.TEXT, fontSize: 14 }} />
                <button type="button" onClick={() => void requestPayout()} disabled={submitting} style={{ padding: "10px 18px", borderRadius: 9, background: `${t.ACCENT}1F`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 14, fontWeight: 600, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                  {submitting && <Loader2 size={14} className="animate-spin" />} Request
                </button>
              </div>
              {formError && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{formError}</div>}
            </>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: t.SUBTLE, margin: "24px 0 12px" }}>Payout history</div>
          {payouts.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: t.MUTED, fontSize: 13, border: `1px dashed ${t.BORDER_HI}`, borderRadius: 14 }}>No payout requests yet.</div>
          ) : (
            payouts.map((p) => (
              <div key={p.id} style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}`, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{p.amount}{p.currency ? ` ${p.currency}` : ""}</div>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: payoutStatusColor(p.status) }}>{payoutStatusLabel(p.status)}</span>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
