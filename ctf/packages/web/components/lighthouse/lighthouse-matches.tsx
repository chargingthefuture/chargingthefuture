"use client";

import { useState } from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { failureText } from "lib/errors/client-failure";
import { MarkRecurringControl } from "@/components/shared/mark-recurring-control";
import { getLighthouseTokens, type Match, type Property } from "./shared";

// A match the host said yes to is a real housing arrangement, and housing is the clearest case of
// something that carries on month after month. LightHouse only ever sees this one moment — it never
// sees the rent that changes hands later — so this is where the member is offered the chance to record
// that it is ongoing, right on the match, instead of being sent to another app to type it in again.
const ACCEPTED_MATCH_STATUSES = new Set(["accepted", "completed"]);

function StatusIcon({ status }: { status: string }) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  if (ACCEPTED_MATCH_STATUSES.has(status)) return <CheckCircle size={28} style={{ color: "#22C55E" }} />;
  if (status === "pending") return <Clock size={28} style={{ color: t.ACCENT }} />;
  return <XCircle size={28} style={{ color: "#EF4444" }} />;
}

const HOST_RESPONSE_FALLBACK = "Could not save your answer. Please try again.";

// A host answers a pending stay request here. Accepting is what opens the private chat for the pair;
// declining closes the request. Both go through PUT /api/lighthouse/matches/:matchId, which also
// refuses a request the seeker has since withdrawn, and its message is shown as it comes back.
function HostResponseControls({ match, onUpdated }: { match: Match; onUpdated?: () => void }) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  const [saving, setSaving] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: "accepted" | "rejected") {
    setSaving(status);
    setError(null);
    try {
      const res = await fetch(`/api/lighthouse/matches/${match.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || data.ok === false) {
        setError(data.message ?? HOST_RESPONSE_FALLBACK);
        return;
      }
      onUpdated?.();
    } catch (caught) {
      setError(failureText(caught, { area: "lighthouse", op: "match_respond", fallback: HOST_RESPONSE_FALLBACK, audience: "member" }));
    } finally {
      setSaving(null);
    }
  }

  const busy = saving !== null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => void respond("accepted")}
          disabled={busy}
          style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
        >
          {saving === "accepted" ? "Accepting…" : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => void respond("rejected")}
          disabled={busy}
          style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: t.INPUT_BG, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
        >
          {saving === "rejected" ? "Declining…" : "Decline"}
        </button>
      </div>
      {error ? <div role="alert" style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}

type LighthouseTokens = ReturnType<typeof getLighthouseTokens>;

// The card's text lines: status, listing, requested date and the seeker's message.
function MatchSummary({ match: m, property: prop, t }: { match: Match; property?: Property; t: LighthouseTokens }) {
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>Match: {m.status.charAt(0).toUpperCase() + m.status.slice(1)}</div>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>Property: {prop?.title ?? m.propertyId}</div>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>Requested: {m.proposedMoveInDateIso ? new Date(m.proposedMoveInDateIso).toLocaleDateString() : "—"}</div>
      {m.message && <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 8 }}>Message: {m.message}</div>}
    </>
  );
}

// What the reader can do next: the host answers a pending request, and either side of an accepted
// match can record it as an ongoing arrangement.
function MatchFollowUps({ match: m, viewerUserId, onMatchUpdated, t }: { match: Match; viewerUserId?: string; onMatchUpdated?: () => void; t: LighthouseTokens }) {
  if (!viewerUserId) return null;
  const isHost = viewerUserId === m.hostUserId;
  return (
    <>
      {m.status === "pending" && isHost ? <HostResponseControls match={m} onUpdated={onMatchUpdated} /> : null}
      {ACCEPTED_MATCH_STATUSES.has(m.status) ? (
        <MarkRecurringControl
          counterpartyUserId={isHost ? m.seekerUserId : m.hostUserId}
          originPlugin="lighthouse"
          sector="housing"
          sectorLabel="a place to stay"
          accent={t.ACCENT}
          style={{ marginTop: 10 }}
        />
      ) : null}
    </>
  );
}

function MatchCard({
  match: m,
  property: prop,
  viewerUserId,
  onSelectProperty,
  onMatchUpdated,
}: {
  match: Match;
  property?: Property;
  viewerUserId?: string;
  onSelectProperty: (property: Property) => void;
  onMatchUpdated?: () => void;
}) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}20`, overflow: "hidden" }}>
      <div style={{ padding: "24px 0", background: `${t.ACCENT}08`, display: "flex", alignItems: "center", justifyContent: "center" }}><StatusIcon status={m.status} /></div>
      <div style={{ padding: 16 }}>
        <MatchSummary match={m} property={prop} t={t} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={() => { if (prop) onSelectProperty(prop); }}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: prop ? "pointer" : "not-allowed", opacity: prop ? 1 : 0.6 }}
            disabled={!prop}
          >
            View
          </button>
          <button style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: t.INPUT_BG, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Message</button>
        </div>
        <MatchFollowUps match={m} viewerUserId={viewerUserId} onMatchUpdated={onMatchUpdated} t={t} />
      </div>
    </div>
  );
}

export function LighthouseMatches({
  matches,
  properties,
  onSelectProperty,
  viewerUserId,
  onMatchUpdated,
}: {
  matches: Match[];
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  // Needed only to work out which side of the match the reader is on, so the ongoing-arrangement
  // control names the other member. Optional so the component still renders without it.
  viewerUserId?: string;
  // Called after the host accepts or declines a request, so the list is read again.
  onMatchUpdated?: () => void;
}) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${t.ACCENT}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Your Matches</div>
        <div style={{ fontSize: 14, color: t.SUBTLE }}>{matches.length} match{matches.length === 1 ? "" : "es"} found</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {matches.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: t.SUBTLE, fontSize: 16, padding: 40 }}>No matches yet.</div>
        ) : (
          matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              property={properties.find((p) => p.id === m.propertyId)}
              viewerUserId={viewerUserId}
              onSelectProperty={onSelectProperty}
              onMatchUpdated={onMatchUpdated}
            />
          ))
        )}
      </div>
    </div>
  );
}
