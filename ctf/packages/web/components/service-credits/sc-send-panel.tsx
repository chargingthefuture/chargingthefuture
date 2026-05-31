"use client";

import { useState } from "react";
import { CheckCircle, Shield } from "lucide-react";
import { ACCEPTED_APPS, COLOR, type WalletData, idempotencyKey } from "./sc-shared";

const inputField: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, fontSize: 13, color: "#E8EAF0", outline: "none", marginBottom: 12, boxSizing: "border-box",
};
const inputLabel: React.CSSProperties = { fontSize: 12, color: "#9CA3AF", marginBottom: 6, display: "block" };

function SendForm({ wallet, onSent }: { wallet: WalletData | null; onSent: () => Promise<void> }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const numeric = Number(amount);
  const canSend = !submitting && recipient.trim().length > 0 && amount.length > 0 && !Number.isNaN(numeric) && numeric > 0;

  async function send() {
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      if (numeric > (wallet?.availableBalance ?? 0)) throw new Error("Insufficient balance");
      const res = await fetch("/api/service-credits/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ recipientUserId: recipient.trim(), amount: numeric, idempotencyKey: idempotencyKey() }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { message?: string };
        throw new Error(d.message ?? "Failed to create transfer.");
      }
      await onSent();
      setSuccess(true);
      setRecipient("");
      setAmount("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create transfer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "16px", borderRadius: 14, marginBottom: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
      <label htmlFor="sc-recipient" style={inputLabel}>Recipient</label>
      <input id="sc-recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} aria-label="Recipient username or ID" placeholder="Survivor username or ID…" style={inputField} />
      <label htmlFor="sc-amount" style={inputLabel}>Amount</label>
      <input id="sc-amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" aria-label="Amount in credits" placeholder="Amount (e.g. 50)" style={inputField} />
      {error && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ fontSize: 12, color: "#22C55E", marginBottom: 8 }}>Credits sent successfully!</div>}
      <button type="button" disabled={!canSend} onClick={send}
        style={{ width: "100%", padding: "10px", borderRadius: 10, background: canSend ? COLOR : "rgba(245,158,11,0.4)", border: "none", color: "#0F1117", fontSize: 14, fontWeight: 800, cursor: canSend ? "pointer" : "not-allowed" }}>
        {submitting ? "Sending…" : "Send Credits"}
      </button>
    </div>
  );
}

export function ServiceCreditsSendPanel({ wallet, onSent }: { wallet: WalletData | null; onSent: () => Promise<void> }) {
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Send Credits</div>
      <SendForm wallet={wallet} onSent={onSent} />

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Accepted Everywhere</div>
      {ACCEPTED_APPS.map((app) => (
        <div key={app} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#9CA3AF" }}>
          <CheckCircle size={12} style={{ color: "#22C55E" }} />
          {app}
        </div>
      ))}

      <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: `${COLOR}06`, border: `1px solid ${COLOR}18` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Shield size={12} style={{ color: COLOR }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Formance Ledger</span>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Every transaction is recorded on the Formance open-source ledger. Transparent, immutable, and verifiable.</div>
      </div>
    </aside>
  );
}
