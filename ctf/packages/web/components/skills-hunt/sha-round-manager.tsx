"use client";

import { useState } from "react";
import type { SkillsHuntRound, SkillsHuntRoundStatus } from "lib/skills-hunt/types";
import { COLOR } from "./sha-shared";

// Round management for the admin shell: create a round and edit an existing
// one (lifecycle status, schedule, and the ServiceCredits reward config). The
// reward fields are what turn a round into a paid round — both default to "no
// reward", so a round pays nothing until an owner sets an amount here.
function toLocalInputValue(source: string | Date): string {
  const date = typeof source === "string" ? new Date(source) : source;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const field: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)", color: "#E8EAF0", fontSize: 13, outline: "none", boxSizing: "border-box",
};
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 5 };
const help: React.CSSProperties = { fontSize: 11, color: "#6B7280", marginTop: 4 };

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
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return Math.floor(n);
}

function RoundForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: FormValues; submitLabel: string; onSubmit: (payload: SubmitPayload) => Promise<void>; onCancel?: () => void;
}) {
  const [v, setV] = useState<FormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<FormValues>) => setV((prev) => ({ ...prev, ...patch }));

  async function submit() {
    setError(null);
    if (!v.name.trim()) { setError("Name is required."); return; }
    const startIso = new Date(v.startsAt).toISOString();
    const endIso = new Date(v.endsAt).toISOString();
    if (Number.isNaN(Date.parse(startIso)) || Number.isNaN(Date.parse(endIso))) { setError("Start and end must be valid dates."); return; }
    if (new Date(endIso) <= new Date(startIso)) { setError("End must be after start."); return; }
    const perAccept = parseWholeNonNegative(v.rewardPerAccept) ?? 0;
    const cap = parseWholeNonNegative(v.rewardCap);
    if (Number.isNaN(perAccept) || Number.isNaN(cap)) { setError("Reward amounts must be whole, non-negative numbers."); return; }
    setSaving(true);
    try {
      await onSubmit({
        name: v.name.trim(), description: v.description.trim() || null, status: v.status,
        startsAtIso: startIso, endsAtIso: endIso, rewardCreditsPerAccept: perAccept, rewardPerUserRoundCap: cap,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save round.");
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, maxWidth: 560 }}>
      <div>
        <label style={label} htmlFor="shr-name">Name</label>
        <input id="shr-name" style={field} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. July Skills Hunt" />
      </div>
      <div>
        <label style={label} htmlFor="shr-desc">Description (optional)</label>
        <textarea id="shr-desc" style={{ ...field, minHeight: 60, resize: "vertical" }} value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="What this round is about" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div>
          <label style={label} htmlFor="shr-status">Status</label>
          <select id="shr-status" style={field} value={v.status} onChange={(e) => set({ status: e.target.value as SkillsHuntRoundStatus })}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label style={label} htmlFor="shr-start">Starts</label>
          <input id="shr-start" type="datetime-local" style={field} value={v.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
        </div>
        <div>
          <label style={label} htmlFor="shr-end">Ends</label>
          <input id="shr-end" type="datetime-local" style={field} value={v.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, padding: "12px 14px", borderRadius: 10, background: `${COLOR}08`, border: `1px solid ${COLOR}25` }}>
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
        <button type="button" onClick={() => void submit()} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, background: COLOR, border: "none", color: "#111", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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

export function SkillsHuntRoundManager({ rounds }: { rounds: SkillsHuntRound[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB" }}>Rounds</div>
        {!creating && (
          <button type="button" onClick={() => { setCreating(true); setEditingId(null); }}
            style={{ padding: "9px 16px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + New round
          </button>
        )}
      </div>

      {creating && (
        <div style={{ marginBottom: 20, padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}25` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 14 }}>Create a round</div>
          <RoundForm
            initial={emptyValues()}
            submitLabel="Create round"
            onCancel={() => setCreating(false)}
            onSubmit={async (payload) => { await putRoundInput("/api/skills-hunt/admin/rounds", "POST", payload, {}); window.location.reload(); }}
          />
        </div>
      )}

      {rounds.length === 0 && !creating ? (
        <div style={{ color: "#6B7280", fontSize: 13 }}>No rounds yet. Use “New round” to create the first one.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rounds.map((r) => (
            <div key={r.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>{r.name} <span style={{ fontSize: 11, fontWeight: 600, color: COLOR }}>· {r.status}</span></div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{rewardLabel(r)}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{new Date(r.startsAtIso).toLocaleDateString()} → {new Date(r.endsAtIso).toLocaleDateString()}</div>
                </div>
                <button type="button" onClick={() => { setEditingId(editingId === r.id ? null : r.id); setCreating(false); }}
                  style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {editingId === r.id ? "Close" : "Edit"}
                </button>
              </div>
              {editingId === r.id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
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
