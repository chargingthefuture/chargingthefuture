"use client";

import type { SkillsHuntMissionGoalType } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens, type SkillsHuntAdminTokens } from "./sha-shared";
import { SectorGoalPicker, SkillGoalPicker } from "./sha-mission-goal-pickers";

export const MISSION_GOAL_TYPES: SkillsHuntMissionGoalType[] = [
  "count_total_accepted", "count_skills_in_sector", "count_rare_skill_finds", "count_skill_matches",
];

// What each goal actually counts, in the admin's own words. The bare enum name was the only label
// this form ever showed, and "count_total_accepted" does not read as "every nomination, whatever
// the skill" to someone naming a mission after one trade — which is how "Find a mechanic" came to
// count 82 nominations that were not mechanics (owner report 2026-09-17).
export const MISSION_GOAL_LABELS: Record<SkillsHuntMissionGoalType, string> = {
  count_total_accepted: "Every accepted nomination, whatever the skill",
  count_skills_in_sector: "Accepted nominations carrying any skill in one sector",
  count_rare_skill_finds: "Accepted nominations that scored a rare-skill bonus",
  count_skill_matches: "Accepted nominations carrying one named skill",
};

const fieldStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({
  width: "100%", padding: "9px 12px", borderRadius: 8, background: t.INPUT_BG,
  border: "1px solid rgba(255,255,255,0.12)", color: t.TEXT, fontSize: 13, outline: "none", boxSizing: "border-box",
});
const labelStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({
  display: "block", fontSize: 12, fontWeight: 600, color: t.SUBTLE, marginBottom: 5,
});

export type MissionGoalFieldsValue = {
  goalType: SkillsHuntMissionGoalType;
  sectorName: string;
  sectorId: string;
  skillName: string;
  skillId: string;
};

export function missionGoalMetadata(value: MissionGoalFieldsValue): Record<string, unknown> {
  if (value.goalType === "count_skills_in_sector") {
    const base: Record<string, unknown> = { sectorName: value.sectorName.trim() };
    if (value.sectorId.trim()) base.sectorId = value.sectorId.trim();
    return base;
  }
  if (value.goalType === "count_skill_matches") {
    const base: Record<string, unknown> = { skillName: value.skillName.trim() };
    if (value.skillId.trim()) base.skillId = value.skillId.trim();
    return base;
  }
  return {};
}

export function missionGoalError(value: MissionGoalFieldsValue): string | null {
  if (value.goalType === "count_skills_in_sector" && !value.sectorName.trim()) {
    return "Choose the sector this mission counts.";
  }
  if (value.goalType === "count_skill_matches" && !value.skillName.trim()) {
    return "Choose the skill this mission counts.";
  }
  return null;
}

// The goal type picker plus whichever extra field that goal needs. Shared by the create form and
// the edit form so the two can never drift into offering different goals.
export function MissionGoalFields({ idPrefix, value, onChange }: {
  idPrefix: string;
  value: MissionGoalFieldsValue;
  onChange: (next: MissionGoalFieldsValue) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const field = fieldStyle(t);

  return (
    <>
      <div>
        <label style={labelStyle(t)} htmlFor={`${idPrefix}-goal`}>Goal type</label>
        <select id={`${idPrefix}-goal`} style={field} value={value.goalType}
          onChange={(e) => onChange({ ...value, goalType: e.target.value as SkillsHuntMissionGoalType })}>
          {MISSION_GOAL_TYPES.map((g) => <option key={g} value={g}>{MISSION_GOAL_LABELS[g]}</option>)}
        </select>
        <div style={{ fontSize: 11, color: t.MUTED, marginTop: 5 }}>
          Stored as <code>{value.goalType}</code>. A mission named for one trade needs the named-skill
          goal — any other goal counts nominations the title does not describe.
        </div>
      </div>
      {value.goalType === "count_skills_in_sector" && (
        <SectorGoalPicker idPrefix={idPrefix} value={value} onChange={onChange} field={field} label={labelStyle(t)} t={t} />
      )}
      {value.goalType === "count_skill_matches" && (
        <SkillGoalPicker idPrefix={idPrefix} value={value} onChange={onChange} field={field} label={labelStyle(t)} t={t} />
      )}
    </>
  );
}
