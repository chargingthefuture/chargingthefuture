"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SkillsHuntMission,
  SkillsHuntMissionGoalType,
  SkillsHuntMissionStatus,
} from "lib/skills-hunt/types";
import { COLOR } from "./sha-shared";

const field: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)", color: "#E8EAF0", fontSize: 13, outline: "none", boxSizing: "border-box",
};
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 5 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };

const GOAL_TYPES: SkillsHuntMissionGoalType[] = [
  "count_total_accepted", "count_skills_in_sector", "count_rare_skill_finds", "count_distinct_sectors",
];
const STATUSES: SkillsHuntMissionStatus[] = ["draft", "active", "locked", "archived"];

function Labeled({ id, text, children }: { id: string; text: string; children: React.ReactNode }) {
  return <div><label style={label} htmlFor={id}>{text}</label>{children}</div>;
}

function MissionRow({ mission, onArchive }: { mission: SkillsHuntMission; onArchive: (id: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {mission.colorHex && <span style={{ width: 12, height: 12, borderRadius: 3, background: mission.colorHex, flexShrink: 0 }} aria-hidden />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "#F9FAFB" }}>{mission.title}</div>
        <div style={{ fontSize: 11, color: "#6B7280" }}>
          {mission.goalType} · target {mission.goalTarget} · +{mission.bonusPoints} pts · {mission.status}
        </div>
      </div>
      {mission.status !== "archived" && (
        <button type="button" onClick={() => onArchive(mission.id)}
          style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: "#9CA3AF", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Archive
        </button>
      )}
    </div>
  );
}

function MissionForm({ roundId, onCreated, onCancel }: { roundId: string; onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState<SkillsHuntMissionGoalType>("count_total_accepted");
  const [goalTarget, setGoalTarget] = useState(1);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [description, setDescription] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [status, setStatus] = useState<SkillsHuntMissionStatus>("active");
  const [sectorName, setSectorName] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    if (!Number.isFinite(goalTarget) || goalTarget < 1) return setError("Goal target must be at least 1.");
    const isSector = goalType === "count_skills_in_sector";
    if (isSector && !sectorName.trim()) return setError("Sector name is required for this goal type.");
    const goalMetadata: Record<string, unknown> = isSector
      ? { sectorName: sectorName.trim(), ...(sectorId.trim() ? { sectorId: sectorId.trim() } : {}) }
      : {};
    setSaving(true);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          title: title.trim(), goalType, goalTarget, bonusPoints,
          description: description.trim() || null, colorHex: colorHex.trim() || null, status, goalMetadata,
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
    <div style={{ marginBottom: 18, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}25` }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 12 }}>New mission</div>
      <div style={{ display: "grid", gap: 12 }}>
        <Labeled id="shm-title" text="Title"><input id="shm-title" style={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Find 5 rare skills" /></Labeled>
        <div style={row}>
          <Labeled id="shm-goal" text="Goal type"><select id="shm-goal" style={field} value={goalType} onChange={(e) => setGoalType(e.target.value as SkillsHuntMissionGoalType)}>{GOAL_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}</select></Labeled>
          <Labeled id="shm-target" text="Goal target"><input id="shm-target" type="number" min={1} style={field} value={goalTarget} onChange={(e) => setGoalTarget(Number(e.target.value))} /></Labeled>
          <Labeled id="shm-bonus" text="Bonus points"><input id="shm-bonus" type="number" min={0} style={field} value={bonusPoints} onChange={(e) => setBonusPoints(Number(e.target.value))} /></Labeled>
          <Labeled id="shm-status" text="Status"><select id="shm-status" style={field} value={status} onChange={(e) => setStatus(e.target.value as SkillsHuntMissionStatus)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Labeled>
          <Labeled id="shm-color" text="Color (optional)"><input id="shm-color" style={field} value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#FBBF24" /></Labeled>
        </div>
        {goalType === "count_skills_in_sector" && (
          <div style={row}>
            <Labeled id="shm-sector-name" text="Sector name"><input id="shm-sector-name" style={field} value={sectorName} onChange={(e) => setSectorName(e.target.value)} placeholder="e.g. Healthcare" /></Labeled>
            <Labeled id="shm-sector-id" text="Sector id (optional)"><input id="shm-sector-id" style={field} value={sectorId} onChange={(e) => setSectorId(e.target.value)} /></Labeled>
          </div>
        )}
        <Labeled id="shm-desc" text="Description (optional)"><textarea id="shm-desc" style={{ ...field, minHeight: 60, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} /></Labeled>
        {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => void submit()} disabled={saving}
            style={{ padding: "9px 18px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Creating…" : "Create mission"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            style={{ padding: "9px 18px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkillsHuntAdminMissions({ roundId }: { roundId: string | null }) {
  const [missions, setMissions] = useState<SkillsHuntMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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

  async function archive(missionId: string) {
    if (!roundId) return;
    if (!window.confirm("Archive this mission? It will no longer be active for players.")) return;
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/missions/${missionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to archive mission.");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to archive mission.");
    }
  }

  if (!roundId) {
    return <div style={{ color: "#9CA3AF", fontSize: 13 }}>Select a round above to manage its missions.</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {open
        ? <MissionForm roundId={roundId} onCreated={() => { setOpen(false); void refresh(); }} onCancel={() => setOpen(false)} />
        : (
          <div style={{ marginBottom: 16 }}>
            <button type="button" onClick={() => setOpen(true)}
              style={{ padding: "9px 16px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + New mission
            </button>
          </div>
        )}
      {error && <div style={{ marginBottom: 12, color: "#EF4444", fontSize: 13 }}>{error}</div>}
      {loading ? (
        <div style={{ color: "#6B7280", fontSize: 13 }}>Loading missions…</div>
      ) : missions.length === 0 ? (
        <div style={{ color: "#6B7280", fontSize: 13 }}>No missions for this round yet.</div>
      ) : (
        <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          {missions.map((m) => <MissionRow key={m.id} mission={m} onArchive={archive} />)}
        </div>
      )}
    </div>
  );
}
