"use client";

import { useState } from "react";
import type { SkillsHuntRound, SkillsHuntRoundStatus } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens, type SkillsHuntAdminTokens } from "./sha-shared";

// Round management for the admin shell: create a round and edit an existing
// one (lifecycle status, schedule, and the ServiceCredits reward config). The
// reward fields are what turn a round into a paid round — both default to "no
// reward", so a round pays nothing until an owner sets an amount here.
function toLocalInputValue(source: string | Date): string {
  const date = typeof source === "string" ? new Date(source) : source;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// maxWidth + minWidth 0 keep a field inside the phone-width column even when the control has a wide
// intrinsic size — a `datetime-local` input reports one wider than the column on iOS Safari. Same
// reasoning as the Mutual Time admin form, which hit this first.
const fieldStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({
  width: "100%", maxWidth: "100%", padding: "9px 12px", borderRadius: 8, background: t.INPUT_BG,
  border: "1px solid rgba(255,255,255,0.12)", color: t.TEXT, fontSize: 13, outline: "none", boxSizing: "border-box", minWidth: 0,
});
const labelStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({ display: "block", fontSize: 12, fontWeight: 600, color: t.SUBTLE, marginBottom: 5 });
const helpStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({ fontSize: 11, color: t.MUTED, marginTop: 4 });

type FormValues = {
  name: string; description: string; status: SkillsHuntRoundStatus;
  startsAt: string; endsAt: string; rewardPerAccept: string; rewardCap: string;
};

type SubmitPayload = {
  name: string; description: string | null; status: SkillsHuntRoundStatus;
  startsAtIso: string; endsAtIso: string; rewardCreditsPerAccept: number; rewardPerUserRoundCap: number | null;
};

function emptyValues(): FormValues {
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 86400000);
  return { name: "", description: "", status: "draft", startsAt: toLocalInputValue(now), endsAt: toLocalInputValue(inAWeek), rewardPerAccept: "0", rewardCap: "" };
}

function fromRound(r: SkillsHuntRound): FormValues {
  return {
    name: r.name, description: r.description ?? "", status: r.status,
    startsAt: toLocalInputValue(r.startsAtIso), endsAt: toLocalInputValue(r.endsAtIso),
    rewardPerAccept: String(r.rewardCreditsPerAccept ?? 0),
    rewardCap: r.rewardPerUserRoundCap === null || r.rewardPerUserRoundCap === undefined ? "" : String(r.rewardPerUserRoundCap),
  };
}

function parseWholeNonNegative(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  // Reject fractional input rather than truncating — payout amounts must be exact whole credits.
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return Number.NaN;
  return n;
}

// Validate the form and assemble the request payload, or return a message to show.
function buildPayloadOrError(v: FormValues): { error: string } | { payload: SubmitPayload } {
  if (!v.name.trim()) return { error: "Name is required." };
  // Validate the dates before calling toISOString(), which throws on an invalid date.
  const startDate = new Date(v.startsAt);
  const endDate = new Date(v.endsAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { error: "Start and end must be valid dates." };
  if (endDate <= startDate) return { error: "End must be after start." };
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();
  const perAccept = parseWholeNonNegative(v.rewardPerAccept) ?? 0;
  const cap = parseWholeNonNegative(v.rewardCap);
  if (Number.isNaN(perAccept) || Number.isNaN(cap)) return { error: "Reward amounts must be whole, non-negative numbers." };
  return {
    payload: {
      name: v.name.trim(), description: v.description.trim() || null, status: v.status,
      startsAtIso: startIso, endsAtIso: endIso, rewardCreditsPerAccept: perAccept, rewardPerUserRoundCap: cap,
    },
  };
}

function RoundForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: FormValues; submitLabel: string; onSubmit: (payload: SubmitPayload) => Promise<void>; onCancel?: () => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const field = fieldStyle(t);
  const label = labelStyle(t);
  const help = helpStyle(t);
  const [v, setV] = useState<FormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<FormValues>) => setV((prev) => ({ ...prev, ...patch }));

  async function submit() {
    setError(null);
    const result = buildPayloadOrError(v);
    if ("error" in result) { setError(result.error); return; }
    setSaving(true);
    try {
      await onSubmit(result.payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save round.");
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, maxWidth: 560 }}>
      <div>
        <label style={label} htmlFor="shr-name">Name</label>
        <input id="shr-name" style={field} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. July SkillsHunt" />
      </div>
      <div>
        <label style={label} htmlFor="shr-desc">Description (optional)</label>
        <textarea id="shr-desc" style={{ ...field, minHeight: 60, resize: "vertical" }} value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="What this round is about" />
      </div>
      {/* One column, and `minmax(0, 1fr)` rather than a length floor: a grid track otherwise takes the
          item's min-content width as its floor, so the two datetime pickers' wide intrinsic size grew
          their tracks and pushed the Starts field past the right edge of the phone-width column.
          `minWidth: 0` on each wrapper is the other half of that. Mobile-first = one column. */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <label style={label} htmlFor="shr-status">Status</label>
          <select id="shr-status" style={field} value={v.status} onChange={(e) => set({ status: e.target.value as SkillsHuntRoundStatus })}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={label} htmlFor="shr-start">Starts</label>
          <input id="shr-start" type="datetime-local" style={field} value={v.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={label} htmlFor="shr-end">Ends</label>
          <input id="shr-end" type="datetime-local" style={field} value={v.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, padding: "12px 14px", borderRadius: 10, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}25` }}>
        <div>
          <label style={label} htmlFor="shr-reward">ServiceCredits per accepted nomination</label>
          <input id="shr-reward" type="number" min={0} step={1} style={field} value={v.rewardPerAccept} onChange={(e) => set({ rewardPerAccept: e.target.value })} />
          <div style={help}>0 = no ServiceCredits paid. Points and badges are still awarded.</div>
        </div>
        <div>
          <label style={label} htmlFor="shr-cap">Per-scout cap this round (optional)</label>
          <input id="shr-cap" type="number" min={0} step={1} style={field} value={v.rewardCap} onChange={(e) => set({ rewardCap: e.target.value })} placeholder="no cap" />
          <div style={help}>Most ServiceCredits one scout can earn this round. Blank = no cap.</div>
        </div>
      </div>
      {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void submit()} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#111", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

async function putRoundInput(url: string, method: "POST" | "PUT", payload: SubmitPayload, scoringConfig: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
    body: JSON.stringify({ ...payload, scoringConfig }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Unable to save round.");
  }
}

function rewardLabel(r: SkillsHuntRound): string {
  if (!r.rewardCreditsPerAccept) return "No ServiceCredits reward";
  const cap = r.rewardPerUserRoundCap === null ? "" : ` · cap ${r.rewardPerUserRoundCap}/scout`;
  return `${r.rewardCreditsPerAccept} ServiceCredits / accept${cap}`;
}

// Manual leaderboard rebuild for a round. The leaderboard is a cached table that
// only refreshes as a side effect of a review action, so this is the way to
// recompute it after an out-of-band change (e.g. a data fix that rejected an
// already-accepted submission) without waiting for the next review.
function RebuildLeaderboardButton({ round, t }: { round: SkillsHuntRound; t: SkillsHuntAdminTokens }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  async function rebuild() {
    if (!window.confirm(`Rebuild the leaderboard for “${round.name}” from its current accepted submissions?`)) return;
    setState("working");
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${round.id}/leaderboard/rebuild`, {
        method: "POST",
        headers: { "x-ctf-csrf": "1" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to rebuild leaderboard.");
      }
      setState("done");
    } catch {
      setState("error");
    }
  }

  const label = state === "working" ? "Rebuilding…" : state === "done" ? "Rebuilt ✓" : state === "error" ? "Failed — retry" : "Rebuild leaderboard";
  return (
    <button type="button" onClick={() => void rebuild()} disabled={state === "working"}
      style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: state === "error" ? "#EF4444" : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: state === "working" ? "not-allowed" : "pointer", opacity: state === "working" ? 0.6 : 1 }}>
      {label}
    </button>
  );
}

export function SkillsHuntRoundManager({ rounds }: { rounds: SkillsHuntRound[] }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Rounds</div>
        {!creating && (
          <button type="button" onClick={() => { setCreating(true); setEditingId(null); }}
            style={{ padding: "9px 16px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + New round
          </button>
        )}
      </div>

      {creating && (
        <div style={{ marginBottom: 20, padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}25` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 14 }}>Create a round</div>
          <RoundForm
            initial={emptyValues()}
            submitLabel="Create round"
            onCancel={() => setCreating(false)}
            onSubmit={async (payload) => { await putRoundInput("/api/skills-hunt/admin/rounds", "POST", payload, {}); window.location.reload(); }}
          />
        </div>
      )}

      {rounds.length === 0 && !creating ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>No rounds yet. Use “New round” to create the first one.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rounds.map((r) => (
            <div key={r.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER_STRONG}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{r.name} <span style={{ fontSize: 11, fontWeight: 600, color: t.ACCENT }}>· {r.status}</span></div>
                  <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 2 }}>{rewardLabel(r)}</div>
                  <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{new Date(r.startsAtIso).toLocaleDateString()} → {new Date(r.endsAtIso).toLocaleDateString()}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <RebuildLeaderboardButton round={r} t={t} />
                  <button type="button" onClick={() => { setEditingId(editingId === r.id ? null : r.id); setCreating(false); }}
                    style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {editingId === r.id ? "Close" : "Edit"}
                  </button>
                </div>
              </div>
              {editingId === r.id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.BORDER}` }}>
                  <RoundForm
                    initial={fromRound(r)}
                    submitLabel="Save changes"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (payload) => { await putRoundInput(`/api/skills-hunt/admin/rounds/${r.id}`, "PUT", payload, r.scoringConfig); window.location.reload(); }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
