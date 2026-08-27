"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillsHuntMission, SkillsHuntMissionGoalType } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens, type SkillsHuntAdminTokens } from "./sha-shared";
import { AdminNumberField } from "./sha-number-field";
import { SkillsHuntAutoMissionPanel } from "./sha-auto-missions";

const fieldStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({
  width: "100%", padding: "9px 12px", borderRadius: 8, background: t.INPUT_BG,
  border: "1px solid rgba(255,255,255,0.12)", color: t.TEXT, fontSize: 13, outline: "none", boxSizing: "border-box",
});
const labelStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({ display: "block", fontSize: 12, fontWeight: 600, color: t.SUBTLE, marginBottom: 5 });
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };

const GOAL_TYPES: SkillsHuntMissionGoalType[] = [
  "count_total_accepted", "count_skills_in_sector", "count_rare_skill_finds",
];

function Labeled({ id, text, children }: { id: string; text: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  return <div><label style={labelStyle(t)} htmlFor={id}>{text}</label>{children}</div>;
}

function missionValidationError(title: string, goalTarget: number, isSector: boolean, sectorName: string): string | null {
  if (!title.trim()) return "Title is required.";
  if (!Number.isFinite(goalTarget) || goalTarget < 1) return "Goal target must be at least 1.";
  if (isSector && !sectorName.trim()) return "Sector name is required for this goal type.";
  return null;
}

function missionGoalMetadata(isSector: boolean, sectorName: string, sectorId: string): Record<string, unknown> {
  if (!isSector) return {};
  const base: Record<string, unknown> = { sectorName: sectorName.trim() };
  if (sectorId.trim()) base.sectorId = sectorId.trim();
  return base;
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

function MissionRow({ mission, onSetStatus }: {
  mission: SkillsHuntMission;
  onSetStatus: (id: string, status: "active" | "archived") => void;
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
          {mission.goalType} · target {mission.goalTarget} · +{mission.bonusPoints} pts
          {mission.status !== "active" && ` · ${mission.status}`}
          {mission.autoCreated && mission.sourceSector && ` · from ${mission.sourceSector} gap`}
        </div>
      </div>
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
  const [goalType, setGoalType] = useState<SkillsHuntMissionGoalType>("count_total_accepted");
  const [goalTarget, setGoalTarget] = useState(1);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [description, setDescription] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [sectorName, setSectorName] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const isSector = goalType === "count_skills_in_sector";
    const validationError = missionValidationError(title, goalTarget, isSector, sectorName);
    if (validationError) return setError(validationError);
    const goalMetadata = missionGoalMetadata(isSector, sectorName, sectorId);
    setSaving(true);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          title: title.trim(), goalType, goalTarget, bonusPoints,
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
        <div style={row}>
          <Labeled id="shm-goal" text="Goal type"><select id="shm-goal" style={field} value={goalType} onChange={(e) => setGoalType(e.target.value as SkillsHuntMissionGoalType)}>{GOAL_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}</select></Labeled>
          <AdminNumberField id="shm-target" label="Goal target" min={1} value={goalTarget} onChange={setGoalTarget} />
          <AdminNumberField id="shm-bonus" label="Bonus points" min={0} value={bonusPoints} onChange={setBonusPoints} />
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

export function SkillsHuntAdminMissions({ roundId }: { roundId: string | null }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
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

  if (!roundId) {
    return <div style={{ color: t.SUBTLE, fontSize: 13 }}>Select a round above to manage its missions.</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <SkillsHuntAutoMissionPanel onRunFinished={() => void refresh()} />
      {open
        ? <MissionForm roundId={roundId} onCreated={() => { setOpen(false); void refresh(); }} onCancel={() => setOpen(false)} />
        : (
          <div style={{ marginBottom: 16 }}>
            <button type="button" onClick={() => setOpen(true)}
              style={{ padding: "9px 16px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + New mission
            </button>
          </div>
        )}
      {error && <div style={{ marginBottom: 12, color: "#EF4444", fontSize: 13 }}>{error}</div>}
      {loading ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>Loading missions…</div>
      ) : missions.length === 0 ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>No missions for this round yet.</div>
      ) : (
        <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER_STRONG}`, overflow: "hidden" }}>
          {missions.map((m) => <MissionRow key={m.id} mission={m} onSetStatus={setStatus} />)}
        </div>
      )}
    </div>
  );
}
