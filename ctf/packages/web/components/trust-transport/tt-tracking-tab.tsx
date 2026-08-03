"use client";

import { useState } from "react";
import { Car, Navigation, MessageCircle, Check, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarkRecurringControl } from "@/components/shared/mark-recurring-control";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens, ttSettlementLabel, type TripRequest, type TtOffer } from "./tt-shared";

const TERMINAL_STATUSES = new Set(["completed", "canceled"]);

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
          <Loader2 size={14} className="ctf-spin" /> Loading offers…
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
              {acceptingId === o.id ? <Loader2 size={14} className="ctf-spin" /> : <Check size={14} />} Accept offer
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// Once a trip is "delivered", completing it requires both parties to confirm on-platform (owner
// decision, 2026-07-08) — completion is what triggers settlement (a ServiceCredits debit from the
// requester, or an earnings-ledger credit for an off-platform fiat/crypto exchange the platform never
// verified), so neither side can complete it alone.
function CompletionConfirm({ tripId, myConfirmedAtIso, otherConfirmedAtIso, onConfirmed }: { tripId: string; myConfirmedAtIso: string | null; otherConfirmedAtIso: string | null; onConfirmed: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trust-transport/trips/${tripId}/complete`, { method: "POST", headers: { "x-ctf-csrf": "1" } });
      if (!res.ok) throw new Error("Could not confirm completion.");
      onConfirmed();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not confirm completion.");
    } finally {
      setSubmitting(false);
    }
  }

  if (myConfirmedAtIso) {
    return (
      <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 9, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B", fontSize: 12, fontWeight: 600 }}>
        You confirmed completion. Waiting for the other party to confirm.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      {error && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{error}</div>}
      <button type="button" onClick={() => void confirm()} disabled={submitting} style={{ width: "100%", padding: "12px", borderRadius: 10, background: `${t.ACCENT}1F`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {submitting ? <Loader2 size={14} className="ctf-spin" /> : <Check size={14} />} Confirm trip completed
      </button>
      {otherConfirmedAtIso && (
        <div style={{ marginTop: 6, fontSize: 11, color: t.MUTED }}>The other party has already confirmed — this finishes it.</div>
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

// The API returns pickup/dropoff cities; keep the older fromLocation/toLocation names as fallbacks.
function resolveLocation(city: string | null | undefined, fallback: string | null | undefined) {
  return city ?? fallback ?? null;
}

// Show the real pickup → drop-off; fall back to the request title so the route is not always "— → —".
function formatRoute(pickup: string | null, dropoff: string | null, title: string | undefined) {
  if (pickup || dropoff) return `${pickup ?? "—"} → ${dropoff ?? "—"}`;
  return title?.trim() || "Your trip";
}

interface TrackingCardModel {
  route: string;
  status: string;
  awaitingDriver: boolean;
  cancellable: boolean;
  awaitingCompletionConfirmation: boolean;
}

function deriveTrackingCardModel(request: TripRequest): TrackingCardModel {
  const pickup = resolveLocation(request.pickupCity, request.fromLocation);
  const dropoff = resolveLocation(request.dropoffCity, request.toLocation);
  const status = request.status ?? "Pending";
  return {
    route: formatRoute(pickup, dropoff, request.title),
    status,
    // An open/pending request has no driver yet — only show the live-map placeholder once a driver is
    // on the way; otherwise say plainly that we're waiting for a driver.
    awaitingDriver: /open|pending|request|search|form|wait/i.test(status),
    cancellable: !TERMINAL_STATUSES.has(status.toLowerCase()),
    // `request.status` already reads "completed" once the trip hits "delivered" (see
    // mapRequestStatusFromTrip) — before mutual completion confirmation and settlement happen. Use the
    // trip's own status to know whether a confirmation is still pending.
    awaitingCompletionConfirmation: request.tripStatus === "delivered",
  };
}

function TrackingCardHeader({ route, status, settlementLabel }: { route: string; status: string; settlementLabel: string }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${t.ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Car size={24} style={{ color: t.ACCENT }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>{route}</div>
      <Badge style={{ background: "rgba(34,197,94,0.10)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.25)", fontSize: 12, marginLeft: "auto" }}>{settlementLabel}</Badge>
      <Badge style={{ ...statusBadgeStyle(status), fontSize: 12 }}>{status}</Badge>
    </div>
  );
}

function TrackingStatusMessage({ awaitingDriver }: { awaitingDriver: boolean }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const message = awaitingDriver
    ? "Waiting for a driver to accept your request."
    : "Your driver is on the way. Status updates as they mark progress — message them on the Direct Line for specifics.";
  return (
    <div style={{ padding: "48px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER}`, textAlign: "center", color: t.SUBTLE, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
      {message}
    </div>
  );
}

function TrackingCompletion({ request, onCompletionConfirmed }: { request: TripRequest; onCompletionConfirmed: () => void }) {
  return (
    <CompletionConfirm
      tripId={request.tripId ?? ""}
      myConfirmedAtIso={request.requesterCompletionConfirmedAtIso ?? null}
      otherConfirmedAtIso={request.providerCompletionConfirmedAtIso ?? null}
      onConfirmed={onCompletionConfirmed}
    />
  );
}

function DirectLineButton({ awaitingDriver, hasMarginBottom, onClick }: { awaitingDriver: boolean; hasMarginBottom: boolean; onClick: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const label = awaitingDriver ? "Direct Line (opens when matched)" : "Direct Line";
  return (
    <button type="button" onClick={onClick} style={{ width: "100%", padding: "12px", borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: hasMarginBottom ? 10 : 0 }}>
      <MessageCircle size={14} /> {label}
    </button>
  );
}

function CancelRequestButton({ requestId, onCancelled }: { requestId: string; onCancelled: () => void }) {
  const [canceling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancel() {
    if (!window.confirm("Cancel this request? This can't be undone.")) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/trust-transport/orders/${requestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Could not cancel this request.");
      onCancelled();
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "Could not cancel this request.");
    } finally {
      setCancelling(false);
    }
  }

  const cursor = canceling ? "default" : "pointer";
  const opacity = canceling ? 0.6 : 1;
  return (
    <>
      {cancelError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 8 }}>{cancelError}</div>}
      <button
        type="button"
        onClick={() => void handleCancel()}
        disabled={canceling}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 13, fontWeight: 600, cursor, opacity, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        {canceling ? <Loader2 size={14} className="ctf-spin" /> : <X size={14} />} Cancel request
      </button>
    </>
  );
}

function TrackingCard({ request, onChat, onAccepted, onCancelled, onCompletionConfirmed }: { request: TripRequest; onChat: (r: TripRequest) => void; onAccepted: () => void; onCancelled: () => void; onCompletionConfirmed: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const model = deriveTrackingCardModel(request);

  return (
    <div style={{ padding: "24px", borderRadius: 16, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}30`, marginBottom: 16 }}>
      <TrackingCardHeader route={model.route} status={model.status} settlementLabel={ttSettlementLabel(request.priceCurrency, request.priceAmount)} />
      <TrackingStatusMessage awaitingDriver={model.awaitingDriver} />
      {model.awaitingDriver && <RequestOffers requestId={request.id} onAccepted={onAccepted} />}
      {model.awaitingCompletionConfirmation && <TrackingCompletion request={request} onCompletionConfirmed={onCompletionConfirmed} />}
      {/* A ride that both sides confirmed is often not a one-off — the same school run every week,
          the same weekly shop. Offered on the finished ride so nobody has to go to another app to
          record it. TrustTransport settles each trip on its own, so a declared ServiceCredits value
          here is recognized as a relationship rather than counted twice — see
          PER_OCCURRENCE_ORIGIN_PLUGINS. */}
      {model.status.toLowerCase() === "completed" && request.tripProviderUserId ? (
        <MarkRecurringControl
          counterpartyUserId={request.tripProviderUserId}
          originPlugin="trust-transport"
          sector="service"
          sectorLabel="a regular ride like this one"
          accent={t.ACCENT}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <DirectLineButton awaitingDriver={model.awaitingDriver} hasMarginBottom={model.cancellable} onClick={() => onChat(request)} />
      {model.cancellable && <CancelRequestButton requestId={request.id} onCancelled={onCancelled} />}
    </div>
  );
}

export function TrustTransportTrackingTab({
  requests,
  onBook,
  onChat,
  onAccepted,
  onCancelled,
  onCompletionConfirmed,
}: {
  requests: TripRequest[];
  onBook: () => void;
  onChat: (r: TripRequest) => void;
  onAccepted: () => void;
  onCancelled: () => void;
  onCompletionConfirmed: () => void;
}) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <div style={{ flex: 1, padding: "24px", overflowY: "auto", minHeight: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 20 }}>Tracking</div>
      {requests.length === 0
        ? <TrackingEmpty onBook={onBook} />
        : requests.map((r) => <TrackingCard key={r.id} request={r} onChat={onChat} onAccepted={onAccepted} onCancelled={onCancelled} onCompletionConfirmed={onCompletionConfirmed} />)}
    </div>
  );
}
