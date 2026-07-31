"use client";

import { useState } from "react";
import { Bath, Bed, Calendar, CheckCircle2, Home, MapPin, Pencil, UserRoundPlus } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { acceptedCurrencyLabels, formatRentParts, getLighthouseTokens, listingAcceptsCredits, type CurrencyMap, type LighthouseTokens, type Property } from "./shared";

// The chips row under the title: property type, location, and a credits flag when accepted.
function ListingBadges({ l, t }: { l: Property; t: LighthouseTokens }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      {l.propertyType && String(l.propertyType).trim().length > 0 ? (
        <span style={{ background: `${t.ACCENT}12`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30`, fontSize: 12, borderRadius: 8, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><Home size={11} />{l.propertyType}</span>
      ) : null}
      {([l.city, l.state].filter((s) => s && String(s).trim().length > 0).join(", ")) ? (
        <span style={{ background: "rgba(255,255,255,0.05)", color: t.SUBTLE, border: `1px solid ${t.BORDER_STRONG}`, fontSize: 12, borderRadius: 8, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{[l.city, l.state].filter((s) => s && String(s).trim().length > 0).join(", ")}</span>
      ) : null}
      {listingAcceptsCredits(l) && <span style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30", fontSize: 12, borderRadius: 8, padding: "3px 10px" }}>Credits ✓</span>}
    </div>
  );
}

// The specs row: bedrooms, bathrooms, and availability date, each shown only when present.
function ListingSpecs({ l, t }: { l: Property; t: LighthouseTokens }) {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 20, fontSize: 14, color: t.SUBTLE, flexWrap: "wrap" }}>
      {Number.isFinite(l.bedrooms) ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bed size={14} />{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bed`}</span>
      ) : null}
      {Number.isFinite(l.bathrooms) ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bath size={14} />{l.bathrooms} bath</span>
      ) : null}
      {l.availableFromIso ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={14} />Available {new Date(l.availableFromIso).toLocaleDateString()}</span>
      ) : null}
    </div>
  );
}

// The rent figure and accepted-currency chips inside the sidebar card.
function ListingPriceCard({ l, currencies, t }: { l: Property; currencies: CurrencyMap; t: LighthouseTokens }) {
  return (
    <>
      {(() => {
        const rent = formatRentParts(l, currencies);
        if (rent === null) return null;
        // Number large; a long unit like "ServiceCredits" stays small so it fits the 280px card.
        return (
          <div style={{ color: t.ACCENT, marginBottom: 4, lineHeight: 1.15, overflowWrap: "anywhere" }}>
            <span style={{ fontSize: 32, fontWeight: 800 }}>{rent.primary}</span>
            {rent.unit ? <span style={{ fontSize: 15, fontWeight: 700, marginLeft: 4 }}>{rent.unit}</span> : null}
            {rent.perMonth ? <span style={{ fontSize: 14, color: t.MUTED, fontWeight: 400 }}>/mo</span> : null}
          </div>
        );
      })()}
      {(() => {
        const accepted = acceptedCurrencyLabels(l, currencies);
        if (accepted.length === 0) {
          return listingAcceptsCredits(l) ? <div style={{ fontSize: 12, color: "#F59E0B", marginBottom: 16 }}>✓ Accepts ServiceCredits</div> : null;
        }
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: t.SUBTLE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Accepts</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {accepted.map((label) => {
                const isCredits = label === "ServiceCredits";
                return (
                  <span key={label} style={{ fontSize: 12, borderRadius: 8, padding: "3px 10px", background: isCredits ? "#F59E0B15" : "rgba(255,255,255,0.05)", color: isCredits ? "#F59E0B" : "#D1D5DB", border: `1px solid ${isCredits ? "#F59E0B30" : t.BORDER_STRONG}` }}>{isCredits ? "✓ " : ""}{label}</span>
                );
              })}
            </div>
          </div>
        );
      })()}
    </>
  );
}

export function LighthousePropertyDetail({
  property,
  currencies,
  onBack,
  currentUserId,
  onEdit,
  onRequested,
  onNeedsProfile,
}: {
  property: Property;
  currencies: CurrencyMap;
  onBack: () => void;
  currentUserId: string;
  onEdit: (p: Property) => void;
  // Called after a match request is created (or found to already exist), so the shell can refresh
  // the Matches tab. Optional so the detail view still renders in contexts that do not wire it.
  onRequested?: () => void;
  // Called when the member has no active seeker profile yet, so the shell can send them to the
  // "Your details" tab to set one up before requesting.
  onNeedsProfile?: () => void;
}) {
  const l = property;
  const isOwn = !!currentUserId && property.hostUserId === currentUserId;
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${t.ACCENT}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER }}>
        <button onClick={onBack} style={{ color: t.ACCENT, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>← Back</button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: t.TITLE, display: "flex", alignItems: "center", gap: 8 }}><Home size={18} strokeWidth={1.75} style={{ color: t.ACCENT }} /> Listing Detail</div>
      </div>
      <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
        <div style={{ marginBottom: 20, padding: "40px 0", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Home size={56} strokeWidth={1.5} style={{ color: `${t.ACCENT}80` }} /></div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.TITLE, marginBottom: 8 }}>{l.title || l.id}</div>
            <ListingBadges l={l} t={t} />
            <ListingSpecs l={l} t={t} />
            {l.description && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.SUBTLE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>About</div>
                <div style={{ fontSize: 14, color: t.SUBTLE, lineHeight: 1.6, marginBottom: 24 }}>{l.description}</div>
              </>
            )}
          </div>
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{ padding: "24px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.ACCENT}25` }}>
              <ListingPriceCard l={l} currencies={currencies} t={t} />
              {isOwn ? (
                <>
                  <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 12, lineHeight: 1.6 }}>This is your listing.</div>
                  <button onClick={() => onEdit(property)} style={{ width: "100%", padding: "12px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#0F1117", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Pencil size={14} /> Edit listing</button>
                </>
              ) : (
                <RequestToStay
                  property={property}
                  t={t}
                  onRequested={onRequested}
                  onNeedsProfile={onNeedsProfile}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Builds the POST body for a match request, normalising empty inputs to null.
function buildMatchRequestBody(propertyId: string, message: string, moveInDate: string) {
  return {
    propertyId,
    message: message.trim() || null,
    desiredMoveInDateIso: moveInDate.trim() || null,
  };
}

type MatchResponseData = { ok?: boolean; code?: string; message?: string };

// Maps the matches endpoint response to a single outcome the handler acts on.
function interpretMatchResponse(ok: boolean, data: MatchResponseData): "sent" | "needs-profile" | "duplicate" | "error" {
  if (ok && data.ok) return "sent";
  // No active seeker profile yet — the endpoint denies until they set one up.
  if (data.code === "policy_denied" || data.code === "profile_not_found") return "needs-profile";
  if (data.code === "duplicate_match") return "duplicate";
  return "error";
}

// The open request form: message, preferred move-in date, and send/cancel controls.
function RequestForm({
  t,
  message,
  setMessage,
  moveInDate,
  setMoveInDate,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  t: LighthouseTokens;
  message: string;
  setMessage: (v: string) => void;
  moveInDate: string;
  setMoveInDate: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 10px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: t.MUTED, fontWeight: 600, marginBottom: 4, display: "block" };
  return (
    <div>
      <label htmlFor="lighthouse-request-message" style={labelStyle}>Message to the host (optional)</label>
      <textarea
        id="lighthouse-request-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Introduce yourself and why this place fits."
        style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
      />
      <label htmlFor="lighthouse-request-movein" style={labelStyle}>Preferred move-in date (optional)</label>
      <input id="lighthouse-request-movein" type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
      {error ? <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 10 }}>{error}</div> : null}
      <button
        onClick={onSubmit}
        disabled={submitting}
        style={{ width: "100%", padding: "12px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#0F1117", fontWeight: 800, fontSize: 15, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1, marginBottom: 8 }}
      >
        {submitting ? "Sending…" : "Send request"}
      </button>
      <button
        onClick={onCancel}
        disabled={submitting}
        style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: `1px solid ${t.BORDER_STRONG}`, color: t.SUBTLE, fontWeight: 600, fontSize: 14, cursor: submitting ? "default" : "pointer" }}
      >
        Cancel
      </button>
    </div>
  );
}

// The seeker-facing action on a listing: request to stay. Creates a match request via
// POST /api/lighthouse/matches, which opens a private chat channel between the seeker and host when
// the host accepts. A member with no active seeker profile is sent to set one up first (the endpoint
// denies the request until they do), tying this action to the "Your details" screen.
function RequestToStay({
  property,
  t,
  onRequested,
  onNeedsProfile,
}: {
  property: Property;
  t: LighthouseTokens;
  onRequested?: () => void;
  onNeedsProfile?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [outcome, setOutcome] = useState<"sent" | "duplicate" | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setNeedsProfile(false);
    try {
      const res = await fetch("/api/lighthouse/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify(buildMatchRequestBody(property.id, message, moveInDate)),
      });
      const data = (await res.json().catch(() => ({}))) as MatchResponseData;
      const result = interpretMatchResponse(res.ok, data);
      if (result === "sent" || result === "duplicate") {
        setOutcome(result);
        setOpen(false);
        onRequested?.();
        return;
      }
      if (result === "needs-profile") {
        setNeedsProfile(true);
        return;
      }
      setError(data.message ?? "Could not send your request. Please try again.");
    } catch {
      setError("Could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome === "sent" || outcome === "duplicate") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#22C55E", fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>
          <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
          {outcome === "sent"
            ? "Request sent. The host will see it in their matches."
            : "You already have an active request for this listing."}
        </div>
        <div style={{ fontSize: 12, color: t.FAINT, textAlign: "center", lineHeight: 1.6 }}>Track it in the Matches tab.</div>
      </div>
    );
  }

  if (needsProfile) {
    return (
      <div>
        <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 12, lineHeight: 1.6 }}>
          Set up your housing details before you request a stay — a host needs to know what you’re
          looking for.
        </div>
        <button
          onClick={() => onNeedsProfile?.()}
          style={{ width: "100%", padding: "12px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#0F1117", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <UserRoundPlus size={15} /> Set up your details
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div>
        <button
          onClick={() => setOpen(true)}
          style={{ width: "100%", padding: "12px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#0F1117", fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 10 }}
        >
          Request to stay
        </button>
        <div style={{ fontSize: 12, color: t.FAINT, textAlign: "center", lineHeight: 1.6 }}>The host sees your details only after you request. Nothing is charged.</div>
      </div>
    );
  }

  return (
    <RequestForm
      t={t}
      message={message}
      setMessage={setMessage}
      moveInDate={moveInDate}
      setMoveInDate={setMoveInDate}
      submitting={submitting}
      error={error}
      onSubmit={() => void submit()}
      onCancel={() => { setOpen(false); setError(null); }}
    />
  );
}
