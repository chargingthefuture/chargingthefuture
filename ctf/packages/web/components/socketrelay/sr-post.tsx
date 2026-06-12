"use client";

import { useState } from "react";
import { COLOR, SUBTLE } from "./sr-shared";
import { CurrencySelect } from "@/components/shared/currency-select";
import type { Currency } from "lib/currency/types";

export type PostDraft = {
  title: string;
  details: string;
  category: string;
  city: string;
  isPublic: boolean;
  // How the request is settled (issue #420): the chosen value type code (default 'FREE' for mutual
  // aid). priceAmount is the entered amount as a string, used only for priced types; it is cleared for
  // amount-less types (Free, Barter) and parsed to a number on submit.
  priceCurrency: string;
  priceAmount: string;
};

export function SocketRelayPost({
  draft,
  onChange,
  submitting,
  error,
  success,
  onSubmit,
}: {
  draft: PostDraft;
  onChange: (patch: Partial<PostDraft>) => void;
  submitting: boolean;
  error: string | null;
  success: boolean;
  onSubmit: () => void;
}) {
  const fieldStyle = { width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" as const };
  // Whether the selected value type needs an amount. Default false: requests start as "Free" (mutual
  // aid), which has no amount. Picking a priced type (ServiceCredits, fiat, crypto) reveals the amount.
  const [requiresAmount, setRequiresAmount] = useState(false);
  function onCurrencyChange(code: string, currency: Currency | null) {
    const needsAmount = currency?.requiresAmount ?? false;
    setRequiresAmount(needsAmount);
    onChange(needsAmount ? { priceCurrency: code } : { priceCurrency: code, priceAmount: "" });
  }
  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>Post a Request</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 620 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Title</div>
          <input value={draft.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="A short summary of what you need or can offer" style={fieldStyle} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Details</div>
          <textarea value={draft.details} onChange={(e) => onChange({ details: e.target.value })} placeholder="Be specific about what help you need or can give…" rows={3} style={{ ...fieldStyle, resize: "none" }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Category</div>
          <input value={draft.category} onChange={(e) => onChange({ category: e.target.value })} placeholder="Food, Transport, Legal, Employment…" style={fieldStyle} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>City (privacy-protected)</div>
          <input value={draft.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="City or neighborhood only — never exact address" style={fieldStyle} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>How will this be settled?</div>
          <CurrencySelect value={draft.priceCurrency} onChange={onCurrencyChange} ariaLabel="How will this be settled?" className="" />
          <div style={{ fontSize: 12, color: SUBTLE, marginTop: 6 }}>Most help here is free. You can also offer ServiceCredits, money, crypto, or a barter — pick what fits.</div>
        </div>
        {requiresAmount && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Amount</div>
            <input
              value={draft.priceAmount}
              onChange={(e) => onChange({ priceAmount: e.target.value.replace(/[^0-9.]/g, "") })}
              inputMode="decimal"
              placeholder="e.g. 20"
              style={fieldStyle}
            />
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9CA3AF", cursor: "pointer" }}>
          <input type="checkbox" checked={draft.isPublic} onChange={(e) => onChange({ isPublic: e.target.checked })} />
          Make this request publicly visible (otherwise members-only)
        </label>
        {error && <div style={{ fontSize: 13, color: "#EF4444" }}>{error}</div>}
        {success && <div style={{ fontSize: 13, color: "#22C55E" }}>Posted successfully! View it in the feed.</div>}
        <button onClick={onSubmit} disabled={submitting} style={{ padding: "14px", borderRadius: 12, background: submitting ? `${COLOR}66` : COLOR, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}>
          {submitting ? "Posting…" : "Post Request"}
        </button>
        <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6 }}>Requests never include identifying information beyond what you write. Connections happen after someone offers to help.</div>
      </div>
    </div>
  );
}
