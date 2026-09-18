"use client";

import { useState } from "react";
import type { SkillsHuntMission } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens } from "./sha-shared";
import { AdminNumberField } from "./sha-number-field";
import {
  MissionGoalFields,
  missionGoalError,
  missionGoalMetadata,
  type MissionGoalFieldsValue,
} from "./sha-mission-goal-fields";

// Editing an existing mission's goal. The admin surface had create and archive and nothing between
// them, so a mission stored with the wrong goal type could only be thrown away and rebuilt — and
// rebuilding loses the row a member's progress hangs off. This is the path that re-points a mission
// such as "Find a mechanic" from "every accepted nomination" to the mechanic skill without the
// owner needing a shell (see the no-terminal rule in CLAUDE.md).
//
// Title, target, bonus and description ride along because an admin correcting a goal usually wants
// to correct the wording in the same pass.

function readString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

// The form's own rules, kept out of submit() so that function stays inside the complexity limit
// (rule 116). The server checks the same things against the merged row; this is so the admin reads
// the rule before a round trip.
function editValidationError(title: string, goalTarget: number, goal: MissionGoalFieldsValue): string | null {
  if (!title.trim()) return "Title is required.";
  if (!Number.isFinite(goalTarget) || goalTarget < 1) return "Goal target must be at least 1.";
  return missionGoalError(goal);
}

function initialGoalValue(mission: SkillsHuntMission): MissionGoalFieldsValue {
  return {
    goalType: mission.goalType,
    sectorName: readString(mission.goalMetadata, "sectorName"),
    sectorId: readString(mission.goalMetadata, "sectorId"),
    skillName: readString(mission.goalMetadata, "skillName"),
    skillId: readString(mission.goalMetadata, "skillId"),
  };
}

export function MissionEditForm({ roundId, mission, onSaved, onCancel }: {
  roundId: string;
  mission: SkillsHuntMission;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const field: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, background: t.INPUT_BG,
    border: "1px solid rgba(255,255,255,0.12)", color: t.TEXT, fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  const labelCss: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: t.SUBTLE, marginBottom: 5 };

  const [title, setTitle] = useState(mission.title);
  const [goal, setGoal] = useState<MissionGoalFieldsValue>(() => initialGoalValue(mission));
  const [goalTarget, setGoalTarget] = useState(mission.goalTarget);
  const [bonusPoints, setBonusPoints] = useState(mission.bonusPoints);
  const [description, setDescription] = useState(mission.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const problem = editValidationError(title, goalTarget, goal);
    if (problem) return setError(problem);

    setSaving(true);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/missions/${mission.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          title: title.trim(),
          goalType: goal.goalType,
          goalTarget,
          bonusPoints,
          goalMetadata: missionGoalMetadata(goal),
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to update mission.");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update mission.");
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderTop: `1px solid ${t.BORDER}` }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={labelCss} htmlFor={`shme-title-${mission.id}`}>Title</label>
          <input id={`shme-title-${mission.id}`} style={field} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <MissionGoalFields idPrefix={`shme-${mission.id}`} value={goal} onChange={setGoal} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <AdminNumberField id={`shme-target-${mission.id}`} label="Goal target" min={1} value={goalTarget} onChange={setGoalTarget} />
          <AdminNumberField id={`shme-bonus-${mission.id}`} label="Bonus points" min={0} value={bonusPoints} onChange={setBonusPoints} />
        </div>
        <div>
          <label style={labelCss} htmlFor={`shme-desc-${mission.id}`}>Description (optional)</label>
          <textarea id={`shme-desc-${mission.id}`} style={{ ...field, minHeight: 60, resize: "vertical" }}
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div style={{ fontSize: 11, color: t.MUTED }}>
          Changing the goal does not move anyone&apos;s stored count on its own — progress is only
          recomputed when a nomination is reviewed. Use &ldquo;Recompute progress&rdquo; above after
          saving so members see the new figure straight away.
        </div>
        {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => void submit()} disabled={saving}
            style={{ padding: "8px 16px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save mission"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.16)", color: t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
