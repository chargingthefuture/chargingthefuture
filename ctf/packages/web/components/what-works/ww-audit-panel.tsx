"use client";

import { useCallback, useState } from "react";
import type { WhatWorksTokens } from "./ww-shared";

// One row of what_works_admin_audit_trail, as the admin route returns it.
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
// what was decided rather than a list of identifiers. An unmapped command falls back to its own
// name — better a raw identifier than a wrong label.
const COMMAND_LABELS: Record<string, string> = {
  "what-works.admin.problem.create": "Added a problem",
  "what-works.admin.problem.update": "Edited a problem",
  "what-works.admin.problem.delete": "Removed a problem",
  "what-works.admin.product.update": "Edited a suggested product",
  "what-works.admin.product.review": "Decided on a suggested product",
  "what-works.admin.product.delete": "Removed a product",
};

// The reason codes carried on a denied or failed action, said plainly. These are the lines that
// explain why an action did not happen, which is half of what the trail is for.
const REASON_LABELS: Record<string, string> = {
  not_found: "the record was not there",
  validation: "the details did not pass validation",
  invalid_payload: "the details did not pass validation",
  persistence_error: "the database write failed",
  policy: "policy refused it",
};

// What the row says about itself, worked out in one place so the component below stays a render.
function describeEvent(event: AuditEvent): { failed: boolean; explanation: string | null; action: string | null } {
  const failed = event.result !== "success" || event.policy_status !== "allow";
  return {
    failed,
    explanation: failed ? REASON_LABELS[event.error_category ?? event.reason] ?? event.reason : null,
    action: typeof event.metadata.action === "string" ? event.metadata.action : null,
  };
}

function EventRow({ event, tokens: t }: { event: AuditEvent; tokens: WhatWorksTokens }) {
  const { failed, explanation, action } = describeEvent(event);
  return (
    <div style={{ padding: 10, borderRadius: 9, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: t.TITLE }}>
          {COMMAND_LABELS[event.command] ?? event.command}
        </span>
        {failed && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 4, padding: "1px 6px" }}>
            {event.policy_status === "deny" ? "Refused" : "Failed"}
          </span>
        )}
      </div>
      {action && <div style={{ fontSize: 11, color: t.SUBTLE, marginBottom: 2 }}>{action}</div>}
      {explanation && <div style={{ fontSize: 11, color: t.SUBTLE, marginBottom: 2 }}>Because {explanation}.</div>}
      <div style={{ fontSize: 11, color: t.SUBTLE }}>
        {event.actor_id} · {event.target_type} {event.target_id}
      </div>
      <div style={{ fontSize: 11, color: t.FAINT }}>{new Date(event.created_at).toLocaleString()}</div>
    </div>
  );
}

function EventList({ events, loading, err, tokens: t }: { events: AuditEvent[] | null; loading: boolean; err: string | null; tokens: WhatWorksTokens }) {
  if (loading) return <div style={{ padding: 16, textAlign: "center", color: t.MUTED, fontSize: 12 }}>Loading…</div>;
  if (err) return <div style={{ padding: 16, textAlign: "center", color: "#EF4444", fontSize: 12 }}>{err}</div>;
  if ((events?.length ?? 0) === 0) return <div style={{ padding: 16, textAlign: "center", color: t.MUTED, fontSize: 12 }}>No admin actions recorded yet.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(events ?? []).map((event) => <EventRow key={event.id} event={event} tokens={t} />)}
    </div>
  );
}

// Collapsible panel listing every admin decision on What Works — adding, editing or removing a
// problem, editing, deciding on or removing a member's suggested product — including the ones that
// were refused and why. Loads lazily on first expand.
//
// This is the check on the admin, including the owner. Until 2026-08-28 these decisions were written
// to the server's log and nowhere else, so a member whose suggestion was removed left no record
// anyone could read back.
export function WhatWorksAuditPanel({ tokens: t }: { tokens: WhatWorksTokens }) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/what-works/admin/audit-events?limit=200");
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
    <div style={{ marginTop: 16, borderRadius: 12, border: `1px solid ${t.BORDER_SOLID}`, background: t.SURFACE }}>
      <button
        type="button"
        onClick={toggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "transparent", border: "none", color: t.TITLE, cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>Audit log</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: t.SUBTLE }}>{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, color: t.SUBTLE, lineHeight: 1.5, marginBottom: 10 }}>
            Every admin decision on What Works, newest first — including the ones that were refused
            and why. Most recent 200.
          </div>
          <EventList events={events} loading={loading} err={err} tokens={t} />
        </div>
      )}
    </div>
  );
}
