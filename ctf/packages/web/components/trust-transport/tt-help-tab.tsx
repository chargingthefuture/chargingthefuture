"use client";

import { useEffect, useState } from "react";
import { HandHeart, Loader2, Check, MessageCircle } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens, ttSettlementLabel, type AvailableRequest, type ChatCreds, type ProviderTrip } from "./tt-shared";
import { StreamChatPanel } from "../shared/stream-chat-panel";

function modeLabel(mode: string | undefined): string {
  if (!mode) return "Request";
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

// The forward step a provider can take from each trip status (the happy path). "delivered" has no
// entry here — from there, completion requires mutual confirmation (see CompletionConfirm below), not a
// single unilateral tap, because completion is what triggers settlement.
const NEXT_STEP: Record<string, { next: string; label: string }> = {
  assigned: { next: "en_route", label: "Start trip" },
  en_route: { next: "picked_up", label: "Mark picked up" },
  picked_up: { next: "delivered", label: "Mark delivered" },
};

function tripStatusLabel(s: string | undefined): string {
  if (s === "en_route") return "En route";
  if (s === "picked_up") return "Picked up";
  if (s === "emergency_frozen") return "Emergency stop";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
}

function tripRoute(trip: ProviderTrip): string {
  return `${trip.pickupCity ?? "—"} → ${trip.dropoffCity ?? "—"}`;
}

const PROOF_TYPES: { key: "photo" | "code" | "note"; label: string; placeholder: string }[] = [
  { key: "photo", label: "Photo", placeholder: "Photo reference or short description" },
  { key: "code", label: "Code", placeholder: "Confirmation code" },
  { key: "note", label: "Note", placeholder: "Short note" },
];

// Capture pickup/delivery proof as a redacted reference (no raw images) for dispute evidence.
function ProofForm({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [type, setType] = useState<"photo" | "code" | "note">("photo");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value.trim()) {
      setError("Add a short reference, code, or note.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trust-transport/trips/${tripId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ artifactType: type, artifactRedacted: value.trim() }),
      });
      if (!res.ok) throw new Error("Could not add proof.");
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add proof.");
    } finally {
      setSubmitting(false);
    }
  }

  const active = PROOF_TYPES.find((p) => p.key === type) ?? PROOF_TYPES[0];

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {PROOF_TYPES.map((p) => (
          <button key={p.key} type="button" onClick={() => setType(p.key)} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: type === p.key ? `${t.ACCENT}20` : t.INPUT_BG, border: `1px solid ${type === p.key ? t.ACCENT + "40" : t.BORDER_HI}`, color: type === p.key ? t.ACCENT : t.SUBTLE }}>
            {p.label}
          </button>
        ))}
      </div>
      <input value={value} maxLength={500} onChange={(e) => setValue(e.target.value)} placeholder={active.placeholder} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.BORDER_HI}`, color: t.TEXT, fontSize: 13 }} />
      <div style={{ fontSize: 11, color: t.MUTED }}>Stored as a redacted reference for dispute evidence — don&apos;t paste sensitive personal detail.</div>
      {error && <div style={{ fontSize: 12, color: "#EF4444" }}>{error}</div>}
      <button type="button" onClick={() => void submit()} disabled={submitting} style={{ padding: "9px 12px", borderRadius: 8, background: `${t.ACCENT}1F`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {submitting && <Loader2 size={14} className="ctf-spin" />} Save proof
      </button>
    </div>
  );
}

// "Chat" toggle for a trip thread, shown to either party once a trip exists. Fetches Stream
// credentials on first open and renders the same panel the requester's Direct Line tab uses.
function TripChat({ tripId }: { tripId: string }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState<ChatCreds | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openChat() {
    setOpen(true);
    if (creds) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trust-transport/trips/${tripId}/chat`, { method: "POST", headers: { "x-ctf-csrf": "1" } });
      if (!res.ok) throw new Error("Could not load chat.");
      const data = (await res.json()) as ChatCreds;
      if (!data.ok) throw new Error(data.message ?? "Could not load chat.");
      setCreds(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load chat.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => void openChat()} style={{ marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <MessageCircle size={14} /> Chat
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, height: 360, borderRadius: 10, overflow: "hidden", border: `1px solid ${t.BORDER_HI}` }}>
      {loading ? (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: t.SUBTLE, fontSize: 13 }}>Loading chat…</div>
      ) : error ? (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 13, padding: 16, textAlign: "center" }}>{error}</div>
      ) : creds?.streamChannelId ? (
        <StreamChatPanel
          streamApiKey={creds.streamApiKey}
          streamToken={creds.streamToken}
          streamUserId={creds.streamUserId}
          streamChannelId={creds.streamChannelId}
          accentColor={t.ACCENT}
        />
      ) : null}
    </div>
  );
}

// Once a trip is "delivered", completing it requires both parties to confirm on-platform (owner
// decision, 2026-07-08) — completion is what triggers settlement (a ServiceCredits debit, or an
// earnings-ledger credit for an off-platform fiat/crypto exchange the platform never verified), so
// neither side can complete it alone.
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
      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 9, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B", fontSize: 12, fontWeight: 600 }}>
        You confirmed completion. Waiting for the other party to confirm.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {error && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{error}</div>}
      <button type="button" onClick={() => void confirm()} disabled={submitting} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, background: `${t.ACCENT}1F`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {submitting ? <Loader2 size={14} className="ctf-spin" /> : <Check size={14} />} Confirm trip completed
      </button>
      {otherConfirmedAtIso && (
        <div style={{ marginTop: 6, fontSize: 11, color: t.MUTED }}>The other party has already confirmed — this finishes it.</div>
      )}
    </div>
  );
}

// The single "advance to the next status" button, shown while a trip is still on the happy path.
function AdvanceButton({ trip, step, busyId, onAdvance }: { trip: ProviderTrip; step: { next: string; label: string }; busyId: string | null; onAdvance: (tripId: string, next: string) => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <button type="button" onClick={() => onAdvance(trip.tripId, step.next)} disabled={busyId !== null} style={{ marginTop: 12, width: "100%", padding: "10px 12px", borderRadius: 9, background: `${t.ACCENT}1F`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: busyId !== null ? "default" : "pointer", opacity: busyId !== null && busyId !== trip.tripId ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
      {busyId === trip.tripId ? <Loader2 size={14} className="ctf-spin" /> : <Check size={14} />} {step.label}
    </button>
  );
}

// The primary action area for a provider's trip: advance one step, confirm completion once delivered,
// or a plain "no further action" line for terminal states.
function TripActionArea({ trip, busyId, onAdvance, onConfirmed }: { trip: ProviderTrip; busyId: string | null; onAdvance: (tripId: string, next: string) => void; onConfirmed: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const step = NEXT_STEP[trip.status ?? ""];
  if (step) {
    return <AdvanceButton trip={trip} step={step} busyId={busyId} onAdvance={onAdvance} />;
  }
  if (trip.status === "delivered") {
    return (
      <CompletionConfirm tripId={trip.tripId} myConfirmedAtIso={trip.providerCompletionConfirmedAtIso ?? null} otherConfirmedAtIso={trip.requesterCompletionConfirmedAtIso ?? null} onConfirmed={onConfirmed} />
    );
  }
  return (
    <div style={{ marginTop: 10, fontSize: 12, color: t.MUTED }}>No further action — this trip is {tripStatusLabel(trip.status).toLowerCase()}.</div>
  );
}

// Pickup/delivery proof controls, hidden entirely on terminal trips.
function ProofSection({ trip, proofOpen, proofDone, onOpen, onProofDone }: { trip: ProviderTrip; proofOpen: boolean; proofDone: boolean; onOpen: () => void; onProofDone: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const terminal = ["completed", "cancelled", "disputed", "emergency_frozen"].includes(trip.status ?? "");
  if (terminal) return null;
  if (proofDone) {
    return <div style={{ marginTop: 10, fontSize: 12, color: t.ACCENT, fontWeight: 600 }}>Proof saved.</div>;
  }
  if (proofOpen) {
    return <ProofForm tripId={trip.tripId} onDone={onProofDone} />;
  }
  return (
    <button type="button" onClick={onOpen} style={{ marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
      Add pickup/delivery proof
    </button>
  );
}

function ProviderTripCard({ trip, busyId, onAdvance, onConfirmed }: { trip: ProviderTrip; busyId: string | null; onAdvance: (tripId: string, next: string) => void; onConfirmed: () => void }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofDone, setProofDone] = useState(false);

  return (
    <div style={{ padding: "14px 16px", borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}25`, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{tripRoute(trip)}</div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: t.ACCENT, background: `${t.ACCENT}1A`, border: `1px solid ${t.ACCENT}33`, borderRadius: 20, padding: "2px 10px" }}>{tripStatusLabel(trip.status)}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: t.SUBTLE }}>{modeLabel(trip.mode)} · {ttSettlementLabel(trip.priceCurrency, trip.priceAmount)}</div>
      <TripActionArea trip={trip} busyId={busyId} onAdvance={onAdvance} onConfirmed={onConfirmed} />
      <ProofSection
        trip={trip}
        proofOpen={proofOpen}
        proofDone={proofDone}
        onOpen={() => setProofOpen(true)}
        onProofDone={() => { setProofDone(true); setProofOpen(false); }}
      />
      <TripChat tripId={trip.tripId} />
    </div>
  );
}

// Trips the member is fulfilling, with controls to advance the lifecycle one step at a time. Renders
// nothing until loaded and nothing when the member has no trips, so it stays out of the way otherwise.
function ProviderTripsSection() {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<ProviderTrip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trust-transport/trips");
      if (!res.ok) throw new Error("Could not load your trips.");
      const data = (await res.json()) as { items?: ProviderTrip[] };
      setTrips(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load your trips.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function advance(tripId: string, nextStatus: string) {
    setBusyId(tripId);
    setError(null);
    try {
      const res = await fetch(`/api/trust-transport/trips/${tripId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ nextStatus }),
      });
      if (!res.ok) throw new Error("Could not update the trip.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update the trip.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || trips.length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: t.SUBTLE, marginBottom: 12 }}>Trips you&apos;re helping with</div>
      {error && <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {trips.map((trip) => (
        <ProviderTripCard key={trip.tripId} trip={trip} busyId={busyId} onAdvance={(id, next) => void advance(id, next)} onConfirmed={() => void load()} />
      ))}
    </div>
  );
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
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
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
        style={{ width: "100%", resize: "vertical", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.BORDER_HI}`, color: t.TEXT, fontSize: 13, fontFamily: "inherit" }}
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="numeric"
        placeholder="Propose an amount (optional)"
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.BORDER_HI}`, color: t.TEXT, fontSize: 13 }}
      />
      {error && <div style={{ fontSize: 12, color: "#EF4444" }}>{error}</div>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        style={{ padding: "10px 12px", borderRadius: 9, background: `${t.ACCENT}1F`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        {submitting && <Loader2 size={14} className="ctf-spin" />} Send offer
      </button>
    </div>
  );
}

function HelpCard({ request }: { request: AvailableRequest }) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <div style={{ padding: "16px 18px", borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}25`, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>{modeLabel(request.mode)}</div>
        <span style={{ fontSize: 12, color: "#22C55E", background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "2px 10px" }}>
          {ttSettlementLabel(request.priceCurrency, request.priceAmount)}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: t.MUTED }}>{postedAgo(request.createdAtIso)}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: t.SUBTLE, lineHeight: 1.5 }}>
        Pickup and drop-off are shared with you only if the requester accepts your offer.
      </div>
      {sent ? (
        <div style={{ marginTop: 12, fontSize: 13, color: t.ACCENT, fontWeight: 600 }}>
          Offer sent. You&apos;ll get the trip details if they accept.
        </div>
      ) : open ? (
        <OfferForm requestId={request.id} onSent={() => { setSent(true); setOpen(false); }} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ marginTop: 12, width: "100%", padding: "10px 12px", borderRadius: 9, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <HandHeart size={14} /> Make an offer
        </button>
      )}
    </div>
  );
}

export function TrustTransportHelpTab() {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
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
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 6 }}>Help out</div>
      <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 20, lineHeight: 1.5, maxWidth: 520 }}>
        Open requests from the community you can offer to help with. To protect people&apos;s safety, you
        see only what kind of help is needed and how it&apos;s settled — the pickup and drop-off are shared
        with you only if the requester accepts your offer.
      </div>
      <ProviderTripsSection />
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: t.SUBTLE, marginBottom: 12 }}>Open requests</div>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.MUTED, fontSize: 13 }}>
          <Loader2 size={16} className="ctf-spin" /> Loading open requests…
        </div>
      ) : error ? (
        <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: t.MUTED, fontSize: 14, border: `1px dashed ${t.BORDER_HI}`, borderRadius: 14 }}>
          No open requests right now. Check back later.
        </div>
      ) : (
        items.map((r) => <HelpCard key={r.id} request={r} />)
      )}
    </div>
  );
}
