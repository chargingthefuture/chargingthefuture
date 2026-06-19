"use client";

import { useState } from "react";
import { COLOR } from "./sha-shared";

// Create a new Skills Hunt round. The POST /api/skills-hunt/admin/rounds endpoint already existed,
// but nothing in the UI surfaced it, so an admin could never create the first round (the moderation
// view only said "Create one before moderating"). On success we reload so the server page re-fetches
// the rounds list and the new round appears in the moderation filter.
function toLocalInputValue(date: Date): string {
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const field: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)", color: "#E8EAF0", fontSize: 13, outline: "none", boxSizing: "border-box",
};
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 5 };

export function SkillsHuntCreateRound() {
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 86400000);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "closed" | "archived">("draft");
  const [startsAt, setStartsAt] = useState(toLocalInputValue(now));
  const [endsAt, setEndsAt] = useState(toLocalInputValue(inAWeek));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const startIso = new Date(startsAt).toISOString();
    const endIso = new Date(endsAt).toISOString();
    if (Number.isNaN(Date.parse(startIso)) || Number.isNaN(Date.parse(endIso))) {
      setError("Start and end must be valid dates.");
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      setError("End must be after start.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/skills-hunt/admin/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status,
          startsAtIso: startIso,
          endsAtIso: endIso,
          scoringConfig: {},
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to create round.");
      }
      // Reload so the server page re-fetches rounds and the new round is selectable.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create round.");
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ padding: "9px 16px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + New round
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24, padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}25` }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 14 }}>Create a round</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, maxWidth: 520 }}>
        <div>
          <label style={label} htmlFor="shr-name">Name</label>
          <input id="shr-name" style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. July Skills Hunt" />
        </div>
        <div>
          <label style={label} htmlFor="shr-desc">Description (optional)</label>
          <textarea id="shr-desc" style={{ ...field, minHeight: 64, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this round is about" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div>
            <label style={label} htmlFor="shr-status">Status</label>
            <select id="shr-status" style={field} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label style={label} htmlFor="shr-start">Starts</label>
            <input id="shr-start" type="datetime-local" style={field} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <label style={label} htmlFor="shr-end">Ends</label>
            <input id="shr-end" type="datetime-local" style={field} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>
        {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => void submit()} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Creating…" : "Create round"}
          </button>
          <button type="button" onClick={() => { setOpen(false); setError(null); }} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
