"use client";

import { useState } from "react";
import { CheckCircle, Shield } from "lucide-react";
import { ACCEPTED_APPS, describeMutualCreditFloor, type WalletData, idempotencyKey } from "./sc-shared";
import { MarkRecurringControl } from "@/components/shared/mark-recurring-control";
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens } from './sc-shared';

const inputField: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, fontSize: 13, color: "#E8EAF0", outline: "none", marginBottom: 12, boxSizing: "border-box",
};
const inputLabel: React.CSSProperties = { fontSize: 12, color: "#9CA3AF", marginBottom: 6, display: "block" };

type Rail = "balance" | "mutual_credit";

// The mutual-credit option is offered only when the member can actually use it — the rail is on and
// they have a line above zero. Offering it otherwise sends them into a server refusal with no way to
// have known, so the option is disabled and the reason is written under the picker instead.
function RailSelector({ rail, onChange, wallet }: { rail: Rail; onChange: (next: Rail) => void; wallet: WalletData | null }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const mutualCreditAvailable = wallet?.mutualCreditEnabled === true && (wallet?.creditLimit ?? 0) > 0;
  const options: { value: Rail; label: string; disabled: boolean }[] = [
    { value: "balance", label: "ServiceCredits", disabled: false },
    { value: "mutual_credit", label: "ServiceCredits — Mutual Credit", disabled: !mutualCreditAvailable },
  ];
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor="sc-rail" style={inputLabel}>Send with</label>
      <select
        id="sc-rail"
        value={rail}
        onChange={(e) => onChange(e.target.value as Rail)}
        aria-label="Send method"
        style={{ ...inputField, marginBottom: 0, appearance: "auto" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled} style={{ color: t.BG }}>{o.label}</option>
        ))}
      </select>
      {(rail === "mutual_credit" || !mutualCreditAvailable) && (
        <div style={{ fontSize: 11, color: t.MUTED, marginTop: 6, lineHeight: 1.5 }}>
          {describeMutualCreditFloor(wallet)}
        </div>
      )}
    </div>
  );
}

// Whether the Send button is live: not already in flight, a recipient typed, and an amount that reads
// as a positive number. Named so the component body states the rule once instead of carrying it inline.
function isSendable({
  submitting,
  recipient,
  amount,
  numeric,
}: {
  submitting: boolean;
  recipient: string;
  amount: string;
  numeric: number;
}): boolean {
  if (submitting) return false;
  if (recipient.trim().length === 0 || amount.length === 0) return false;
  return !Number.isNaN(numeric) && numeric > 0;
}

// Send the transfer and hand back the recipient id the SERVER resolved — the box takes a username, and
// the "Is this ongoing?" prompt needs a real member id to name. Throws with the route's own message so
// the caller shows what actually failed rather than a fixed sentence.
async function postTransfer({
  recipient,
  amount,
  rail,
}: {
  recipient: string;
  amount: number;
  rail: Rail;
}): Promise<string | null> {
  const res = await fetch("/api/service-credits/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
    body: JSON.stringify({
      recipientUserId: recipient,
      amount,
      idempotencyKey: idempotencyKey(),
      ...(rail === "mutual_credit" ? { rail } : {}),
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    message?: string;
    transfer?: { recipientUserId?: string };
  };
  if (!res.ok) {
    throw new Error(payload.message ?? "Failed to create transfer.");
  }
  return payload.transfer?.recipientUserId ?? null;
}

function SendForm({ wallet, onSent }: { wallet: WalletData | null; onSent: () => Promise<void> }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [rail, setRail] = useState<Rail>("balance");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Who the completed send went to, kept after the form clears so the "Is this ongoing?" prompt can
  // name them. A standing arrangement settled in credits is exactly the case the Recurring Activity
  // plugin exists for, and the moment right after a send is when the member knows it.
  const [sentToUserId, setSentToUserId] = useState<string | null>(null);

  const numeric = Number(amount);
  const canSend = isSendable({ submitting, recipient, amount, numeric });

  async function send() {
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      // The balance rail keeps the client-side guard. The mutual-credit rail is allowed to go
      // negative up to the member's limit, so we do not block here — the server decides.
      if (rail === "balance" && numeric > (wallet?.availableBalance ?? 0)) throw new Error("Insufficient balance");
      const recipientUserId = await postTransfer({ recipient: recipient.trim(), amount: numeric, rail });
      await onSent();
      setSuccess(true);
      // The server resolves a username to a real member id, so read it back rather than reusing what
      // was typed in the box.
      setSentToUserId(recipientUserId);
      setRecipient("");
      setAmount("");
      setRail("balance");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create transfer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "16px", borderRadius: 14, marginBottom: 16, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20` }}>
      <label htmlFor="sc-recipient" style={inputLabel}>Recipient</label>
      <input id="sc-recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} aria-label="Recipient username or ID" placeholder="Survivor username or ID…" style={inputField} />
      <RailSelector rail={rail} onChange={setRail} wallet={wallet} />
      <label htmlFor="sc-amount" style={inputLabel}>Amount</label>
      <input id="sc-amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" aria-label="Amount in credits" placeholder="Amount (e.g. 50)" style={inputField} />
      {error && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ fontSize: 12, color: "#22C55E", marginBottom: 8 }}>Credits sent successfully!</div>}
      {success && sentToUserId ? (
        <div style={{ marginBottom: 10 }}>
          <MarkRecurringControl
            counterpartyUserId={sentToUserId}
            originPlugin="service-credits"
            sector="general"
            sectorLabel="something you settle in credits"
            accent={t.ACCENT}
          />
        </div>
      ) : null}
      <button type="button" disabled={!canSend} onClick={send}
        style={{ width: "100%", padding: "10px", borderRadius: 10, background: canSend ? t.ACCENT : "rgba(245,158,11,0.4)", border: "none", color: t.BG, fontSize: 14, fontWeight: 800, cursor: canSend ? "pointer" : "not-allowed" }}>
        {submitting ? "Sending…" : "Send Credits"}
      </button>
    </div>
  );
}

// The body of the Send tab. It was a panel pinned under every tab until 2026-08-27; now it renders
// once, only when the member opens Send, so the sticky tab bar above it is the only divider it needs
// (the old borderTop would double up with the header's own).
export function ServiceCreditsSendPanel({ wallet, onSent }: { wallet: WalletData | null; onSent: () => Promise<void>; isMobile?: boolean }) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  return (
    <aside style={{ width: "100%", border: "none", background: t.HEADER, padding: "20px 16px", flexShrink: 0, boxSizing: "border-box" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>Send Credits</div>
      <SendForm wallet={wallet} onSent={onSent} />

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 10 }}>Accepted Everywhere</div>
      {ACCEPTED_APPS.map((app) => (
        <div key={app} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: t.SUBTLE }}>
          <CheckCircle size={12} style={{ color: "#22C55E" }} />
          {app}
        </div>
      ))}

      <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: `${t.ACCENT}06`, border: `1px solid ${t.ACCENT}18` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Shield size={12} style={{ color: t.ACCENT }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: t.ACCENT }}>Formance Ledger</span>
        </div>
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>Every transaction is recorded on the Formance open-source ledger. Transparent, immutable, and verifiable.</div>
      </div>
    </aside>
  );
}
