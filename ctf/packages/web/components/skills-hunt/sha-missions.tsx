"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillsHuntMission } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens, type SkillsHuntAdminTokens } from "./sha-shared";
import { AdminNumberField } from "./sha-number-field";
import { SkillsHuntAutoMissionPanel } from "./sha-auto-missions";
import { SaveImageButton } from "@/components/shared/save-image-button";
import { MissionEditForm } from "./sha-mission-edit";
import {
  MISSION_GOAL_LABELS,
  MissionGoalFields,
  missionGoalError,
  missionGoalMetadata,
  type MissionGoalFieldsValue,
} from "./sha-mission-goal-fields";

const fieldStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({
  width: "100%", padding: "9px 12px", borderRadius: 8, background: t.INPUT_BG,
  border: "1px solid rgba(255,255,255,0.12)", color: t.TEXT, fontSize: 13, outline: "none", boxSizing: "border-box",
});
const labelStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({ display: "block", fontSize: 12, fontWeight: 600, color: t.SUBTLE, marginBottom: 5 });
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };

function Labeled({ id, text, children }: { id: string; text: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  return <div><label style={labelStyle(t)} htmlFor={id}>{text}</label>{children}</div>;
}

function missionValidationError(title: string, goalTarget: number, goal: MissionGoalFieldsValue): string | null {
  if (!title.trim()) return "Title is required.";
  if (!Number.isFinite(goalTarget) || goalTarget < 1) return "Goal target must be at least 1.";
  return missionGoalError(goal);
}

// Shared error-shaping for the mission calls, kept out of the handlers so each stays within the
// complexity limit (rule 116).
async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// No request body on the soft-archive DELETE, so no Content-Type — only the CSRF confirmation header.
function archiveRequest(): RequestInit {
  return { method: "DELETE", headers: { "x-ctf-csrf": "1" } };
}

function activateRequest(status: "active" | "archived"): RequestInit {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
    body: JSON.stringify({ status }),
  };
}

// The sector or skill a goal is about, so the list says what a mission counts without opening it.
// Before this the row showed only the raw goal-type name, which is how a mission titled for one
// trade sat in the list looking unremarkable while counting every nomination the scout had.
function goalSubject(mission: SkillsHuntMission): string {
  const metadata = mission.goalMetadata;
  const skill = metadata.skillName;
  if (mission.goalType === "count_skill_matches" && typeof skill === "string" && skill.trim()) {
    return skill.trim();
  }
  const sector = metadata.sectorName;
  if (mission.goalType === "count_skills_in_sector" && typeof sector === "string" && sector.trim()) {
    return sector.trim();
  }
  return "";
}

function MissionRow({ mission, onSetStatus, onEdit }: {
  mission: SkillsHuntMission;
  onSetStatus: (id: string, status: "active" | "archived") => void;
  onEdit: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const isArchived = mission.status === "archived";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderTop: `1px solid ${t.BORDER}` }}>
      {mission.colorHex && <span style={{ width: 12, height: 12, borderRadius: 3, background: mission.colorHex, flexShrink: 0 }} aria-hidden />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600, color: t.TITLE }}>{mission.title}</span>
          {mission.autoCreated && (
            <span style={{ padding: "1px 7px", borderRadius: 999, background: `${t.ACCENT}18`, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 10, fontWeight: 700 }}>
              auto
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: t.MUTED }}>
          {MISSION_GOAL_LABELS[mission.goalType] ?? mission.goalType}
          {goalSubject(mission) && ` — ${goalSubject(mission)}`}
          {` · target ${mission.goalTarget} · +${mission.bonusPoints} pts`}
          {mission.status !== "active" && ` · ${mission.status}`}
          {mission.autoCreated && mission.sourceSector && ` · from ${mission.sourceSector} gap`}
        </div>
      </div>
      <button type="button" onClick={() => onEdit(mission.id)}
        style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: t.SUBTLE, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
        Edit
      </button>
      <button type="button" onClick={() => onSetStatus(mission.id, isArchived ? "active" : "archived")}
        style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: isArchived ? t.ACCENT : t.SUBTLE, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
        {isArchived ? "Activate" : "Archive"}
      </button>
    </div>
  );
}

function MissionForm({ roundId, onCreated, onCancel }: { roundId: string; onCreated: () => void; onCancel: () => void }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const field = fieldStyle(t);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<MissionGoalFieldsValue>({
    goalType: "count_total_accepted", sectorName: "", sectorId: "", skillName: "", skillId: "",
  });
  const [goalTarget, setGoalTarget] = useState(1);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [description, setDescription] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const validationError = missionValidationError(title, goalTarget, goal);
    if (validationError) return setError(validationError);
    const goalMetadata = missionGoalMetadata(goal);
    setSaving(true);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          title: title.trim(), goalType: goal.goalType, goalTarget, bonusPoints,
          description: description.trim() || null, colorHex: colorHex.trim() || null, goalMetadata,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to create mission.");
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create mission.");
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 18, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}25` }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>New mission</div>
      <div style={{ display: "grid", gap: 12 }}>
        <Labeled id="shm-title" text="Title"><input id="shm-title" style={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Find 5 rare skills" /></Labeled>
        <MissionGoalFields idPrefix="shm" value={goal} onChange={setGoal} />
        <div style={row}>
          <AdminNumberField id="shm-target" label="Goal target" min={1} value={goalTarget} onChange={setGoalTarget} />
          <AdminNumberField id="shm-bonus" label="Bonus points" min={0} value={bonusPoints} onChange={setBonusPoints} />
          <Labeled id="shm-color" text="Color (optional)"><input id="shm-color" style={field} value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#FBBF24" /></Labeled>
        </div>
        <Labeled id="shm-desc" text="Description (optional)"><textarea id="shm-desc" style={{ ...field, minHeight: 60, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} /></Labeled>
        {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => void submit()} disabled={saving}
            style={{ padding: "9px 18px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Creating…" : "Create mission"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            style={{ padding: "9px 18px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Saves this round's active missions as one tall picture, to post where the round is being
// advertised. It lives here rather than on the member Missions tab (owner decision, 2026-09-20):
// advertising a round is an admin job, and the member tab is where members read their own progress.
//
// The picture is drawn and then shown on this screen, to be pressed and held, shared, or saved
// from here — see components/shared/save-image-button.tsx for the two earlier attempts that each
// stranded the owner on a dead page instead.
function MissionPosterCard({ roundId }: { roundId: string }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <SaveImageButton
      url={`/api/skills-hunt/admin/rounds/${roundId}/missions/image`}
      filename={`skillshunt-missions-${today}.png`}
      label="Show these missions as one picture"
      accent={t.ACCENT}
      surface="rgba(255,255,255,0.02)"
      border={t.BORDER_STRONG}
      muted={t.MUTED}
      area="skills-hunt"
      op="mission_poster_image"
      style={{ marginTop: 0, marginBottom: 16 }}
    >
      Draws every active mission in this round as one tall picture, named for today&apos;s date, so
      the round can be advertised without stitching screenshots together. It appears here: on a
      phone, press and hold it to save it to your photos, or use Share to send it straight to
      another app. You stay on this screen either way. The picture carries the missions themselves,
      not anyone&apos;s progress.
    </SaveImageButton>
  );
}

export function SkillsHuntAdminMissions({ roundId }: { roundId: string | null }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const [missions, setMissions] = useState<SkillsHuntMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!roundId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/missions`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to load missions.");
      }
      const data = (await res.json()) as { items: SkillsHuntMission[] };
      setMissions(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load missions.");
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Archiving and bringing a mission back are the same operation in opposite directions, so both
  // run through here. Archiving takes a mission away from members and is confirm-gated; activating
  // is the harmless direction and is not. Archive keeps using DELETE (the soft-archive route);
  // activating uses PUT, which has always existed but had no caller until now.
  async function setStatus(missionId: string, status: "active" | "archived") {
    if (!roundId) return;
    const archiving = status === "archived";
    if (archiving && !window.confirm("Archive this mission? It will no longer be active for players.")) return;
    const failure = archiving ? "Unable to archive mission." : "Unable to activate mission.";
    try {
      const res = await fetch(
        `/api/skills-hunt/admin/rounds/${roundId}/missions/${missionId}`,
        archiving ? archiveRequest() : activateRequest(status),
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, failure));
      }
      await refresh();
    } catch (e) {
      setError(errorText(e, failure));
    }
  }

  // Settles every scout's counts in the round from the current accepted nominations. Needed after a
  // goal is corrected, because progress is otherwise only recomputed when a nomination is reviewed —
  // so a re-pointed mission keeps showing its old number until the next acceptance happens by.
  async function recomputeProgress() {
    if (!roundId) return;
    setNotice(null);
    setError(null);
    setRecomputing(true);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/missions/recompute`, {
        method: "POST",
        headers: { "x-ctf-csrf": "1" },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Unable to recompute mission progress."));
      }
      const body = (await res.json()) as { scoutsRecomputed?: number };
      const count = body.scoutsRecomputed ?? 0;
      setNotice(`Recomputed mission progress for ${count} scout${count === 1 ? "" : "s"} in this round.`);
    } catch (e) {
      setError(errorText(e, "Unable to recompute mission progress."));
    } finally {
      setRecomputing(false);
    }
  }

  if (!roundId) {
    return <div style={{ color: t.SUBTLE, fontSize: 13 }}>Select a round above to manage its missions.</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <SkillsHuntAutoMissionPanel onRunFinished={() => void refresh()} />
      <MissionPosterCard roundId={roundId} />
      {open
        ? <MissionForm roundId={roundId} onCreated={() => { setOpen(false); void refresh(); }} onCancel={() => setOpen(false)} />
        : (
          <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setOpen(true)}
              style={{ padding: "9px 16px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + New mission
            </button>
            <button type="button" onClick={() => void recomputeProgress()} disabled={recomputing}
              style={{ padding: "9px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: recomputing ? "not-allowed" : "pointer", opacity: recomputing ? 0.6 : 1 }}>
              {recomputing ? "Recomputing…" : "Recompute progress"}
            </button>
          </div>
        )}
      {notice && <div style={{ marginBottom: 12, color: t.ACCENT, fontSize: 13 }}>{notice}</div>}
      {error && <div style={{ marginBottom: 12, color: "#EF4444", fontSize: 13 }}>{error}</div>}
      {loading ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>Loading missions…</div>
      ) : missions.length === 0 ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>No missions for this round yet.</div>
      ) : (
        <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER_STRONG}`, overflow: "hidden" }}>
          {missions.map((m) => (
            <div key={m.id}>
              <MissionRow mission={m} onSetStatus={setStatus} onEdit={(id) => setEditingId(editingId === id ? null : id)} />
              {editingId === m.id && (
                <MissionEditForm
                  roundId={roundId}
                  mission={m}
                  onSaved={() => { setEditingId(null); void refresh(); }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
