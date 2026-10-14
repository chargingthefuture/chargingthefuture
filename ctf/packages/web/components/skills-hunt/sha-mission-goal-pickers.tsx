"use client";

import { useState } from "react";
import type { SkillsHuntAdminTokens } from "./sha-shared";
import { useTaxonomyOptions, type TaxonomyOption } from "./sha-taxonomy-options";
import type { MissionGoalFieldsValue } from "./sha-mission-goal-fields";

// Sector and skill for a mission goal, picked from the skills taxonomy rather than typed. The name
// and its id are set together from the one choice, so the two can never disagree and a name can
// never be misspelled into a goal that counts nothing.

type PickerProps = {
  idPrefix: string;
  value: MissionGoalFieldsValue;
  onChange: (next: MissionGoalFieldsValue) => void;
  field: React.CSSProperties;
  label: React.CSSProperties;
  t: SkillsHuntAdminTokens;
};

const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };

// A mission saved before these pickers may name something that is not in the taxonomy (renamed, or
// typed by hand). It is kept as an option, marked, so opening the edit form does not silently drop it.
function withCurrent(options: TaxonomyOption[], id: string, name: string): TaxonomyOption[] {
  if (!name.trim() || options.some((o) => o.id === id || o.name.toLowerCase() === name.trim().toLowerCase())) return options;
  return [{ id: id || `current:${name}`, name: `${name} (not in the taxonomy)` }, ...options];
}

function selectedId(options: TaxonomyOption[], id: string, name: string): string {
  const match = options.find((o) => (id && o.id === id) || o.name.toLowerCase() === name.trim().toLowerCase());
  return match?.id ?? (name.trim() ? id || `current:${name}` : "");
}

function nameOf(options: TaxonomyOption[], id: string): string {
  return options.find((o) => o.id === id)?.name.replace(/ \(not in the taxonomy\)$/, "") ?? "";
}

function TaxonomyStatus({ message, t }: { message: string; t: SkillsHuntAdminTokens }) {
  return <div style={{ fontSize: 12, color: t.MUTED }}>{message}</div>;
}

export function SectorGoalPicker({ idPrefix, value, onChange, field, label, t }: PickerProps) {
  const taxonomy = useTaxonomyOptions();
  if (taxonomy.status === "loading") return <TaxonomyStatus message="Loading sectors…" t={t} />;
  if (taxonomy.status === "error") return <TaxonomyStatus message={taxonomy.message} t={t} />;
  const options = withCurrent(taxonomy.sectors, value.sectorId, value.sectorName);
  return (
    <div>
      <label style={label} htmlFor={`${idPrefix}-sector`}>Sector</label>
      <select id={`${idPrefix}-sector`} style={field} value={selectedId(options, value.sectorId, value.sectorName)}
        onChange={(e) => onChange({ ...value, sectorId: e.target.value.startsWith("current:") ? "" : e.target.value, sectorName: nameOf(options, e.target.value) })}>
        <option value="">Choose a sector</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

function sectorOfSkill(skillsBySector: Record<string, TaxonomyOption[]>, skillId: string, skillName: string): string {
  const name = skillName.trim().toLowerCase();
  for (const [sectorId, skills] of Object.entries(skillsBySector)) {
    if (skills.some((s) => (skillId && s.id === skillId) || (name && s.name.toLowerCase() === name))) return sectorId;
  }
  return "";
}

function SkillSelects({ idPrefix, value, onChange, field, label, sectors, skillsBySector }: Omit<PickerProps, "t"> & {
  sectors: TaxonomyOption[];
  skillsBySector: Record<string, TaxonomyOption[]>;
}) {
  const [sectorId, setSectorId] = useState(() => sectorOfSkill(skillsBySector, value.skillId, value.skillName));
  const skills = withCurrent(skillsBySector[sectorId] ?? [], value.skillId, value.skillName);
  return (
    <div style={row}>
      <div>
        <label style={label} htmlFor={`${idPrefix}-skill-sector`}>Sector</label>
        <select id={`${idPrefix}-skill-sector`} style={field} value={sectorId}
          onChange={(e) => { setSectorId(e.target.value); onChange({ ...value, skillId: "", skillName: "" }); }}>
          <option value="">Choose a sector</option>
          {sectors.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <div>
        <label style={label} htmlFor={`${idPrefix}-skill`}>Skill</label>
        <select id={`${idPrefix}-skill`} style={field} value={selectedId(skills, value.skillId, value.skillName)} disabled={skills.length === 0}
          onChange={(e) => onChange({ ...value, skillId: e.target.value.startsWith("current:") ? "" : e.target.value, skillName: nameOf(skills, e.target.value) })}>
          <option value="">{sectorId ? "Choose a skill" : "Choose a sector first"}</option>
          {skills.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
    </div>
  );
}

export function SkillGoalPicker(props: PickerProps) {
  const taxonomy = useTaxonomyOptions();
  if (taxonomy.status === "loading") return <TaxonomyStatus message="Loading skills…" t={props.t} />;
  if (taxonomy.status === "error") return <TaxonomyStatus message={taxonomy.message} t={props.t} />;
  return (
    <div>
      <SkillSelects {...props} sectors={taxonomy.sectors} skillsBySector={taxonomy.skillsBySector} />
      <div style={{ fontSize: 11, color: props.t.MUTED, marginTop: 5 }}>
        Counts accepted nominations that picked this skill. Free-text proposed skills are not counted.
      </div>
    </div>
  );
}
