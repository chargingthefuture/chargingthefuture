"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens, type SkillsHuntAdminTokens } from "./sha-shared";

// One row of skills_hunt_audit_log, as the admin route returns it.
type AuditEvent = {
  id: string;
  actor_id: string;
  command: string;
  policy_status: string;
  reason: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Plain-language names for the commands an admin will actually see here, so the list reads as a
// record of what was done rather than a list of identifiers. An unmapped command falls back to its
// own name — better a raw identifier than a wrong label.
const COMMAND_LABELS: Record<string, string> = {
  "skills-hunt.submission.review": "Reviewed a nomination",
  "skills-hunt.submission.remove": "Removed a nomination",
  "skills-hunt.submission.restore": "Restored a nomination",
  "skills-hunt.submission.create": "Nomination submitted",
  "skills-hunt.round.create": "Created a round",
  "skills-hunt.round.update": "Updated a round",
  "skills-hunt.leaderboard.rebuild": "Rebuilt the leaderboard",
  "skills-hunt.mission.create": "Created a mission",
  "skills-hunt.mission.update": "Updated a mission",
  "skills-hunt.mission.archive": "Archived a mission",
  "skills-hunt.mission.auto_generate": "Auto-mission run",
  "skills-hunt.mission.auto_config_update": "Changed auto-mission settings",
  "skills-hunt.feature-reward-card.update": "Updated the reward card",
  "skills-hunt.notification.round_ending_soon": "Sent round-ending notifications",
  "skills-hunt.profile.delete": "Member deleted their SkillsHunt data",
};

// The review action carried in metadata, said plainly. This is the detail that makes the log worth
// reading: "Reviewed a nomination" alone does not say whether it was accepted or removed from view.
const ACTION_LABELS: Record<string, string> = {
  accept: "accepted",
  reject: "rejected",
  flag: "flagged",
  unflag: "un-flagged",
  edit: "edited",
};

// Each fact the metadata may carry, said plainly. A table rather than a chain of ifs so a new
// recorded field is one row here, and the whole description is a filter and a join.
const METADATA_PHRASES: ReadonlyArray<(meta: Record<string, unknown>) => string | null> = [
  (meta) => (typeof meta.action === "string" ? ACTION_LABELS[meta.action] ?? meta.action : null),
  (meta) => {
    const from = typeof meta.fromStatus === "string" ? meta.fromStatus : null;
    const to = typeof meta.toStatus === "string" ? meta.toStatus : null;
    return from && to && from !== to ? `${from} → ${to}` : null;
  },
  (meta) => (meta.restoredFromRemoved === true ? "also restored it from removed" : null),
  (meta) => (meta.alreadyRemoved === true ? "was already removed" : null),
  (meta) => (meta.alreadyLive === true ? "was already live" : null),
  (meta) => (typeof meta.emitted === "number" ? `${meta.emitted} sent` : null),
  (meta) => {
    const opened = typeof meta.opened === "number" ? meta.opened : null;
    const updated = typeof meta.updated === "number" ? meta.updated : null;
    return opened === null && updated === null ? null : `${opened ?? 0} opened, ${updated ?? 0} updated`;
  },
  (meta) => (typeof meta.skipped === "string" ? `skipped: ${meta.skipped}` : null),
];

function describeMetadata(event: AuditEvent): string | null {
  const parts = METADATA_PHRASES
    .map((phrase) => phrase(event.metadata))
    .filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function EventRow({ event, tokens: t }: { event: AuditEvent; tokens: SkillsHuntAdminTokens }) {
  const denied = event.policy_status !== "allow";
  const detail = describeMetadata(event);
  return (
    <div style={{ border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 12, background: t.HEADER, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>
          {COMMAND_LABELS[event.command] ?? event.command}
        </span>
        {denied && (
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.45)", color: "#EF4444" }}>
            {event.policy_status}
          </span>
        )}
      </div>
      {detail && <div style={{ fontSize: 12, color: t.SUBTLE }}>{detail}</div>}
      <div style={{ fontSize: 11, color: t.MUTED }}>
        {event.actor_id} · {event.target_type} {event.target_id}
      </div>
      <div style={{ fontSize: 11, color: t.FAINT }}>{new Date(event.created_at).toLocaleString()}</div>
    </div>
  );
}

// The audit trail, readable. Every admin action on this plugin writes a row to skills_hunt_audit_log
// and nothing in the app ever showed them, so the record existed but could not be checked. It is the
// thing that keeps the admin surface honest, which only works if an admin can read it.
export function SkillsHuntAdminAudit() {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills-hunt/admin/audit-events?limit=200");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to load the audit trail.");
      }
      const data = (await res.json()) as { events: AuditEvent[] };
      setEvents(data.events ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the audit trail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: t.SUBTLE }}>
          Every admin action on SkillsHunt, newest first. Most recent 200.
        </span>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          style={{ padding: "6px 14px", borderRadius: 8, background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}`, color: t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: loading ? "default" : "pointer" }}>
          Refresh
        </button>
      </div>

      {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}

      {loading ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>Loading the audit trail…</div>
      ) : events.length === 0 ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>No audit events recorded yet.</div>
      ) : (
        events.map((event) => <EventRow key={event.id} event={event} tokens={t} />)
      )}
    </div>
  );
}
