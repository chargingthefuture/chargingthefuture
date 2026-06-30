"use client";

import { useEffect, useState } from "react";
import { HandHeart, Loader2 } from "lucide-react";
import { COLOR, ttSettlementLabel, type AvailableRequest } from "./tt-shared";

function modeLabel(mode: string | undefined): string {
  if (!mode) return "Request";
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

// Plain relative age ("just now", "5 min ago", "2 h ago", "3 d ago") from an ISO timestamp.
function postedAgo(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function OfferForm({ requestId, onSent }: { requestId: string; onSent: () => void }) {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const parsed = Number(amount);
      const proposedAmount = amount.trim().length > 0 && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
      const res = await fetch(`/api/trust-transport/requests/${requestId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ note: note.trim() || null, proposedAmount }),
      });
      if (!res.ok) throw new Error("Could not send your offer. Please try again.");
      onSent();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send your offer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a short note (optional) — e.g. when you can help"
        rows={2}
        style={{ width: "100%", resize: "vertical", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", color: "#E8EAF0", fontSize: 13, fontFamily: "inherit" }}
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="numeric"
        placeholder="Propose an amount (optional)"
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", color: "#E8EAF0", fontSize: 13 }}
      />
      {error && <div style={{ fontSize: 12, color: "#EF4444" }}>{error}</div>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        style={{ padding: "10px 12px", borderRadius: 9, background: `${COLOR}1F`, border: `1px solid ${COLOR}40`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />} Send offer
      </button>
    </div>
  );
}

function HelpCard({ request }: { request: AvailableRequest }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <div style={{ padding: "16px 18px", borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}25`, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB" }}>{modeLabel(request.mode)}</div>
        <span style={{ fontSize: 12, color: "#22C55E", background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "2px 10px" }}>
          {ttSettlementLabel(request.priceCurrency, request.priceAmount)}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6B7280" }}>{postedAgo(request.createdAtIso)}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
        Pickup and drop-off are shared with you only if the requester accepts your offer.
      </div>
      {sent ? (
        <div style={{ marginTop: 12, fontSize: 13, color: COLOR, fontWeight: 600 }}>
          Offer sent. You&apos;ll get the trip details if they accept.
        </div>
      ) : open ? (
        <OfferForm requestId={request.id} onSent={() => { setSent(true); setOpen(false); }} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ marginTop: 12, width: "100%", padding: "10px 12px", borderRadius: 9, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <HandHeart size={14} /> Make an offer
        </button>
      )}
    </div>
  );
}

export function TrustTransportHelpTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AvailableRequest[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/trust-transport/requests/available");
        if (!res.ok) throw new Error("Could not load open requests.");
        const data = (await res.json()) as { items?: AvailableRequest[] };
        if (active) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Could not load open requests.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  return (
    <div style={{ flex: 1, padding: "24px", overflowY: "auto", minHeight: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 6 }}>Help out</div>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20, lineHeight: 1.5, maxWidth: 520 }}>
        Open requests from the community you can offer to help with. To protect people&apos;s safety, you
        see only what kind of help is needed and how it&apos;s settled — the pickup and drop-off are shared
        with you only if the requester accepts your offer.
      </div>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7280", fontSize: 13 }}>
          <Loader2 size={16} className="animate-spin" /> Loading open requests…
        </div>
      ) : error ? (
        <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#6B7280", fontSize: 14, border: "1px dashed rgba(255,255,255,0.10)", borderRadius: 14 }}>
          No open requests right now. Check back later.
        </div>
      ) : (
        items.map((r) => <HelpCard key={r.id} request={r} />)
      )}
    </div>
  );
}
