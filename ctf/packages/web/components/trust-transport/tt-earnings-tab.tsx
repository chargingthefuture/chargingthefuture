"use client";

import { useEffect, useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { COLOR, type TtPayout } from "./tt-shared";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [payouts, setPayouts] = useState<TtPayout[]>([]);
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
      const balData = (await balRes.json()) as { availableBalance?: number };
      const payData = (await payRes.json()) as { items?: TtPayout[] };
      setBalance(typeof balData.availableBalance === "number" ? balData.availableBalance : 0);
      setPayouts(Array.isArray(payData.items) ? payData.items : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load your earnings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function requestPayout() {
    const parsed = Number(amount);
    if (!(Number.isFinite(parsed) && parsed > 0)) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (parsed > balance) {
      setFormError("That's more than your available balance.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/trust-transport/payouts/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ amount: Math.round(parsed) }),
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
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 6 }}>Earnings</div>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20, lineHeight: 1.5, maxWidth: 520 }}>
        What you&apos;ve earned by helping fulfil trips, and your payout requests. Payouts are reviewed by an admin.
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7280", fontSize: 13 }}>
          <Loader2 size={16} className="animate-spin" /> Loading earnings…
        </div>
      ) : error ? (
        <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>
      ) : (
        <>
          <div style={{ padding: "18px 20px", borderRadius: 16, background: `${COLOR}0F`, border: `1px solid ${COLOR}30`, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Wallet size={18} style={{ color: COLOR }} />
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>Available balance</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "#F9FAFB" }}>{balance}</div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 12 }}>Request a payout</div>
          {requested && <div style={{ fontSize: 13, color: COLOR, fontWeight: 600, marginBottom: 10 }}>Payout requested. You&apos;ll see it below with its status.</div>}
          <div style={{ display: "flex", gap: 8, marginBottom: 8, maxWidth: 420 }}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="Amount" disabled={balance <= 0} style={{ flex: 1, padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", color: "#E8EAF0", fontSize: 14 }} />
            <button type="button" onClick={() => void requestPayout()} disabled={submitting || balance <= 0} style={{ padding: "10px 18px", borderRadius: 9, background: `${COLOR}1F`, border: `1px solid ${COLOR}40`, color: COLOR, fontSize: 14, fontWeight: 600, cursor: submitting || balance <= 0 ? "default" : "pointer", opacity: submitting || balance <= 0 ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
              {submitting && <Loader2 size={14} className="animate-spin" />} Request
            </button>
          </div>
          {balance <= 0 && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>You can request a payout once you have an available balance.</div>}
          {formError && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{formError}</div>}

          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9CA3AF", margin: "24px 0 12px" }}>Payout history</div>
          {payouts.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#6B7280", fontSize: 13, border: "1px dashed rgba(255,255,255,0.10)", borderRadius: 14 }}>No payout requests yet.</div>
          ) : (
            payouts.map((p) => (
              <div key={p.id} style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>{p.amount}</div>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: payoutStatusColor(p.status) }}>{payoutStatusLabel(p.status)}</span>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
