"use client";

import { useCallback, useState } from "react";
import { ScrollText } from "lucide-react";
import { COLOR } from "./shared";

const BORDER = "#1E2A3A";
const TEXT = "#F9FAFB";
const SUBTLE = "#6B7280";

// One row of directory_admin_audit_trail, as the admin route returns it.
type AuditEvent = {
  id: string;
  actor_id: string;
  command: string;
  policy_status: string;
  reason: string;
  target_type: string;
  target_id: string;
  result: string;
  error_category: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Plain-language names for the commands an admin will see here, so the list reads as a record of
// what was done rather than a list of identifiers. An unmapped command falls back to its own name —
// better a raw identifier than a wrong label.
const COMMAND_LABELS: Record<string, string> = {
  "directory.admin.profile.create": "Created a profile",
  "directory.admin.profile.update": "Edited a profile",
  "directory.admin.profile.delete": "Deleted a profile",
  "directory.admin.profile.assign": "Attached a profile to an account",
  "directory.admin.profile.takedown": "Removed a profile at the person's request",
  "directory.admin.takedown.override": "Lifted a Quora URL block",
  "directory.admin.announcement.upsert": "Saved an announcement",
  "directory.admin.announcement.deactivate": "Took down an announcement",
};

// The reason codes carried on a denied or failed action, said plainly. These are the lines that
// explain why an action did not happen, which is half of what the trail is for.
const REASON_LABELS: Record<string, string> = {
  not_found: "the record was not there",
  already_taken_down: "it was already taken down",
  already_claimed: "someone has claimed it",
  not_community_generated: "it is not a community-generated profile",
  validation: "the details did not pass validation",
  persistence_error: "the database write failed",
  policy: "policy refused it",
};

function EventRow({ event }: { event: AuditEvent }) {
  const failed = event.result !== "success" || event.policy_status !== "allow";
  const explanation = failed ? REASON_LABELS[event.error_category ?? event.reason] ?? event.reason : null;
  return (
    <div style={{ padding: 10, borderRadius: 9, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: TEXT }}>
          {COMMAND_LABELS[event.command] ?? event.command}
        </span>
        {failed && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 4, padding: "1px 6px" }}>
            {event.policy_status === "deny" ? "Refused" : "Failed"}
          </span>
        )}
      </div>
      {explanation && <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 2 }}>Because {explanation}.</div>}
      <div style={{ fontSize: 11, color: SUBTLE }}>
        {event.actor_id} · {event.target_type} {event.target_id}
      </div>
      <div style={{ fontSize: 11, color: SUBTLE, opacity: 0.75 }}>{new Date(event.created_at).toLocaleString()}</div>
    </div>
  );
}

function EventList({ events, loading, err }: { events: AuditEvent[] | null; loading: boolean; err: string | null }) {
  if (loading) return <div style={{ padding: 16, textAlign: "center", color: SUBTLE, fontSize: 12 }}>Loading…</div>;
  if (err) return <div style={{ padding: 16, textAlign: "center", color: "#EF4444", fontSize: 12 }}>{err}</div>;
  if ((events?.length ?? 0) === 0) return <div style={{ padding: 16, textAlign: "center", color: SUBTLE, fontSize: 12 }}>No admin actions recorded yet.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(events ?? []).map((event) => <EventRow key={event.id} event={event} />)}
    </div>
  );
}

// Collapsible panel listing every admin action taken on the Directory — profile edits and deletions,
// takedowns at a person's request, Quora URL blocks and the lifting of one, announcement changes —
// including the ones that were refused and why. Loads lazily on first expand.
//
// This is the check on the admin, including the owner. Until 2026-08-28 the Directory wrote these
// events to the server's log and nowhere else, so a takedown left nothing anyone could read back.
export function DirectoryAuditPanel() {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/directory/admin/audit-events?limit=200");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setErr(body?.message ?? "Could not load the audit trail.");
        return;
      }
      const data = (await res.json()) as { events?: AuditEvent[] };
      setEvents(data.events ?? []);
    } catch {
      setErr("Could not load the audit trail.");
    } finally {
      setLoading(false);
    }
  }, []);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next) void loadList();
  }

  return (
    <div style={{ margin: "0 16px 16px", borderRadius: 12, border: `1px solid ${BORDER}`, background: "#0D0F14" }}>
      <button
        onClick={toggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "transparent", border: "none", color: TEXT, cursor: "pointer", textAlign: "left" }}
      >
        <ScrollText size={15} color={COLOR} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Audit log</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: SUBTLE }}>{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.5, marginBottom: 10 }}>
            Every admin action on the Directory, newest first — including the ones that were refused
            and why. Most recent 200.
          </div>
          <EventList events={events} loading={loading} err={err} />
        </div>
      )}
    </div>
  );
}
