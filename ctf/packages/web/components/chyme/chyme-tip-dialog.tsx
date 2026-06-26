"use client";

import { useState } from "react";
import { Coins, X } from "lucide-react";
import { PRIMARY, requestJson } from "./chyme-shared";

// A "Tip" action shown on another participant's tile in the Chyme room. It sends ServiceCredits
// peer-to-peer to that participant via POST /api/chyme/service-credits (origin_plugin 'chyme'),
// which delivers immediately. The caller renders this only for other members (never on the local
// member's own tile, and never on a listen-only guest, who has no wallet).
export function ChymeTipButton({
  recipientUserId,
  recipientName,
}: {
  recipientUserId: string;
  recipientName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Tip ${recipientName}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginTop: 4,
          fontSize: 10,
          fontWeight: 700,
          color: PRIMARY,
          background: `${PRIMARY}14`,
          border: `1px solid ${PRIMARY}35`,
          borderRadius: 20,
          padding: "2px 8px",
          cursor: "pointer",
        }}
      >
        <Coins size={11} /> Tip
      </button>
      {open ? (
        <ChymeTipDialog
          recipientUserId={recipientUserId}
          recipientName={recipientName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ChymeTipDialog({
  recipientUserId,
  recipientName,
  onClose,
}: {
  recipientUserId: string;
  recipientName: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const numeric = Number(amount);
  const canSend = !submitting && !success && amount.length > 0 && !Number.isNaN(numeric) && numeric > 0;

  async function send() {
    if (!canSend) return;
    setSubmitting(true);
    setError(null);
    try {
      // requestJson attaches the x-ctf-csrf header on non-GET requests and throws the server's
      // message on a non-2xx response, so a failed tip surfaces the real reason (e.g. insufficient
      // balance) rather than a generic error.
      await requestJson<{ ok: true }>("/api/chyme/service-credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toUserId: recipientUserId,
          amount: numeric,
          message: message.trim() || undefined,
        }),
      });
      setSuccess(true);
      window.setTimeout(onClose, 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send the tip.");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    fontSize: 14,
    color: "#E8EAF0",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Tip ${recipientName}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 320, maxWidth: "100%", background: "#041a0b", border: `1px solid ${PRIMARY}30`, borderRadius: 16, padding: 20 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#F0FDF4" }}>Tip {recipientName}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", lineHeight: 0 }}>
            <X size={18} />
          </button>
        </div>
        <label htmlFor="chyme-tip-amount" style={{ display: "block", fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>Amount (ServiceCredits)</label>
        <input
          id="chyme-tip-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="1"
          inputMode="numeric"
          placeholder="e.g. 10"
          aria-label="Tip amount in ServiceCredits"
          style={fieldStyle}
        />
        <label htmlFor="chyme-tip-message" style={{ display: "block", fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>Message (optional)</label>
        <input
          id="chyme-tip-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Say something"
          aria-label="Optional message with the tip"
          style={fieldStyle}
        />
        {error ? <div role="alert" style={{ fontSize: 12, color: "#EF4444", marginBottom: 10 }}>{error}</div> : null}
        {success ? <div role="status" style={{ fontSize: 12, color: PRIMARY, marginBottom: 10 }}>Tip sent.</div> : null}
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void send()}
          style={{ width: "100%", padding: "11px", borderRadius: 10, background: canSend ? PRIMARY : `${PRIMARY}66`, border: "none", color: "#021006", fontSize: 14, fontWeight: 800, cursor: canSend ? "pointer" : "not-allowed" }}
        >
          {submitting ? "Sending…" : "Send tip"}
        </button>
        <div style={{ fontSize: 10, color: "#4B5563", marginTop: 10, lineHeight: 1.5 }}>
          Sends ServiceCredits from your wallet to {recipientName}. No fees; not a fiat value.
        </div>
      </div>
    </div>
  );
}
