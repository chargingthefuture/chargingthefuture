"use client";

import { useState } from "react";
import { Car, Navigation, MessageCircle, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens, ttSettlementLabel, type TripRequest, type TtOffer } from "./tt-shared";

// Offers on the requester's own open request, with Accept. Accepting opens a trip and (per discovery
// model B) is the point at which the chosen provider gains the pickup/drop-off via the trip.
function RequestOffers({ requestId, onAccepted }: { requestId: string; onAccepted: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<TtOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trust-transport/requests/${requestId}/offers`);
      if (!res.ok) throw new Error("Could not load offers.");
      const data = (await res.json()) as { items?: TtOffer[] };
      setOffers(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load offers.");
    } finally {
      setLoading(false);
    }
  }

  async function accept(offerId: string) {
    setAcceptingId(offerId);
    setError(null);
    try {
      const res = await fetch(`/api/trust-transport/offers/${offerId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) throw new Error("Could not accept this offer.");
      onAccepted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not accept this offer.");
    } finally {
      setAcceptingId(null);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => void load()} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, background: t.INPUT_BG, border: `1px solid ${t.BORDER_HI}`, color: t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        View offers
      </button>
    );
  }

  const pending = offers.filter((o) => (o.status ?? "pending") === "pending");

  return (
    <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.MUTED, fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" /> Loading offers…
        </div>
      ) : error ? (
        <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>
      ) : pending.length === 0 ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>No offers yet. You&apos;ll see them here as people offer to help.</div>
      ) : (
        pending.map((o) => (
          <div key={o.id} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.BORDER_STRONG}` }}>
            <div style={{ fontSize: 13, color: t.TEXT, fontWeight: 600 }}>
              A community member{o.proposedAmount != null ? ` · proposes ${o.proposedAmount}` : ""}
            </div>
            {o.note && <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 4, lineHeight: 1.5 }}>{o.note}</div>}
            <button
              type="button"
              onClick={() => void accept(o.id)}
              disabled={acceptingId !== null}
              style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: `${t.ACCENT}1F`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: acceptingId !== null ? "default" : "pointer", opacity: acceptingId !== null && acceptingId !== o.id ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}
            >
              {acceptingId === o.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Accept offer
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function statusBadgeStyle(status: string) {
  const s = status.toLowerCase();
  if (s.includes("cancel")) return { background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" };
  if (s.includes("complet")) return { background: "#A855F720", color: "#A855F7", border: "1px solid #A855F740" };
  if (s.includes("pend") || s.includes("form") || s.includes("wait")) return { background: "#F59E0B20", color: "#F59E0B", border: "1px solid #F59E0B40" };
  return { background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E40" };
}

function TrackingEmpty({ onBook }: { onBook: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px dashed ${t.ACCENT_TINT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Navigation size={20} style={{ color: t.ACCENT_TAB_BORDER }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.SUBTLE }}>No active trips</div>
      <div style={{ fontSize: 13, color: t.FAINT }}>Book a ride to follow its status here.</div>
      <button type="button" onClick={onBook} style={{ padding: "10px 20px", borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Book a Ride
      </button>
    </div>
  );
}

function TrackingCard({ request, onChat, onAccepted }: { request: TripRequest; onChat: (r: TripRequest) => void; onAccepted: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const pickup = request.pickupCity ?? request.fromLocation ?? null;
  const dropoff = request.dropoffCity ?? request.toLocation ?? null;
  // Show the real pickup → drop-off; fall back to the request title (the API sends pickupCity /
  // dropoffCity / title, never fromLocation / toLocation), so the route is no longer always "— → —".
  const route = pickup || dropoff ? `${pickup ?? "—"} → ${dropoff ?? "—"}` : (request.title?.trim() || "Your trip");
  const status = request.status ?? "Pending";
  // An open/pending request has no driver yet — nothing is being tracked. Only show the live-map
  // placeholder once a driver is on the way; otherwise say plainly that we're waiting for a driver.
  const awaitingDriver = /open|pending|request|search|form|wait/i.test(status);
  return (
    <div style={{ padding: "24px", borderRadius: 16, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}30`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${t.ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Car size={24} style={{ color: t.ACCENT }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>{route}</div>
        <Badge style={{ background: "rgba(34,197,94,0.10)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.25)", fontSize: 12, marginLeft: "auto" }}>{ttSettlementLabel(request.priceCurrency, request.priceAmount)}</Badge>
        <Badge style={{ ...statusBadgeStyle(status), fontSize: 12 }}>{status}</Badge>
      </div>
      <div style={{ padding: "48px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}`, textAlign: "center", color: t.SUBTLE, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        {awaitingDriver
          ? "Waiting for a driver to accept your request."
          : "Your driver is on the way. Status updates as they mark progress — message them on the Direct Line for specifics."}
      </div>
      {awaitingDriver && <RequestOffers requestId={request.id} onAccepted={onAccepted} />}
      <button type="button" onClick={() => onChat(request)} style={{ width: "100%", padding: "12px", borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <MessageCircle size={14} /> {awaitingDriver ? "Direct Line (opens when matched)" : "Direct Line"}
      </button>
    </div>
  );
}

export function TrustTransportTrackingTab({
  requests,
  onBook,
  onChat,
  onAccepted,
}: {
  requests: TripRequest[];
  onBook: () => void;
  onChat: (r: TripRequest) => void;
  onAccepted: () => void;
}) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ flex: 1, padding: "24px", overflowY: "auto", minHeight: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 20 }}>Tracking</div>
      {requests.length === 0
        ? <TrackingEmpty onBook={onBook} />
        : requests.map((r) => <TrackingCard key={r.id} request={r} onChat={onChat} onAccepted={onAccepted} />)}
    </div>
  );
}
