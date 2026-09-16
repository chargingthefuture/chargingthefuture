"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";

// The audit trail, readable.
//
// Every write in this plugin has recorded a row in fireside_audit_events since it shipped, and
// nothing in the app ever showed one. A record nobody can read is not a check on anything (rule
// 131), and the powers on this screen are the kind that need one: taking somebody's words out of
// the conversation, and agreeing to copy them onto a page a web archive keeps forever.
//
// Both halves of an export decision appear here — the author's request and the admin's answer —
// because that pair is what lets text leave the app for somewhere nobody can recall it from.

type AuditEvent = {
  id: string;
  actorId: string;
  command: string;
  policyStatus: string;
  reason: string;
  targetType: string;
  targetId: string;
  result: string;
  createdAt: string;
};

// Plain-language names for what was done, so the list reads as a record of actions rather than a
// list of identifiers. An unmapped command falls back to its own name — a raw identifier beats a
// wrong label.
const COMMAND_LABELS: Record<string, string> = {
  "fireside.comment.create": "Someone wrote a comment",
  "fireside.comment.withdraw": "An author took their own comment down",
  "fireside.comment.set_export": "An author asked for the blog, or took the ask back",
  "fireside.comment.remove": "Removed a comment",
  "fireside.comment.restore": "Put a comment back",
  "fireside.reaction.toggle": "A reaction or a vote",
  "fireside.export.approve": "Approved a comment for the blog",
  "fireside.export.refuse": "Declined a comment for the blog",
  "fireside.thread.close": "Closed a conversation",
  "fireside.thread.reopen": "Opened a conversation again",
};

function EventRow({ event, t }: { event: AuditEvent; t: PluginShellTokens }) {
  const denied = event.policyStatus !== "allow";
  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: t.TEXT }}>
          {COMMAND_LABELS[event.command] ?? event.command}
        </span>
        {denied && (
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.45)", color: "#F87171" }}>
            {event.policyStatus}
          </span>
        )}
      </div>
      {event.result && <div style={{ fontSize: 13, color: t.SUBTLE, marginTop: 4 }}>{event.result}</div>}
      {event.reason && <div style={{ fontSize: 13, color: t.SUBTLE, marginTop: 4 }}>{event.reason}</div>}
      <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6 }}>
        {event.actorId} · {event.targetType} {event.targetId}
      </div>
      <div style={{ fontSize: 12, color: t.FAINT, marginTop: 2 }}>
        {new Date(event.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

export function FiresideAdminAudit({ t }: { t: PluginShellTokens }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fireside/admin/audit-events?limit=200");
      const data = (await res.json()) as { message?: string; events?: AuditEvent[] };
      if (!res.ok) throw new Error(data.message ?? "Could not load the audit trail.");
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the audit trail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: t.TEXT, margin: "0 0 6px" }}>Audit log</h2>
        <button type="button" onClick={() => void load()} disabled={loading}
          style={{ background: "transparent", border: `1px solid ${t.BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: t.SUBTLE, cursor: loading ? "default" : "pointer" }}>
          Refresh
        </button>
      </div>
      <p style={{ fontSize: 15, color: t.TEXT, lineHeight: 1.7, marginTop: 0 }}>
        Every write here, newest first — what members did and what an admin did about it. The most
        recent 200.
      </p>

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 15, color: "#F87171" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 15, color: t.SUBTLE }}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: t.SUBTLE, fontSize: 15, lineHeight: 1.7 }}>
          Nothing recorded yet. A row lands here the first time anybody writes, reacts, or moderates.
        </div>
      ) : (
        events.map((event) => <EventRow key={event.id} event={event} t={t} />)
      )}
    </div>
  );
}
