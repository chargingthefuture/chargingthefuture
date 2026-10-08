"use client";

import type { CSSProperties } from "react";

type TaxonomyOption = { id: string; name: string };
type JobTitleOption = { id: string; name: string; sectorId: string };

// One sector's group of job titles, used to build the job-title dropdown's <optgroup> list.
export type JobTitleGroup = { sectorId: string; sectorName: string; titles: JobTitleOption[] };

// Every job title, grouped by its sector, so the job-title dropdown lists them all (via <optgroup>)
// without having to pick a sector first — the two selectors are independent.
export function groupJobTitlesBySector(
  sectors: TaxonomyOption[],
  jobTitles: JobTitleOption[],
): JobTitleGroup[] {
  const sectorNameById = new Map(sectors.map((s) => [s.id, s.name] as const));
  const bySector = new Map<string, JobTitleOption[]>();
  for (const j of jobTitles) {
    const arr = bySector.get(j.sectorId) ?? [];
    arr.push(j);
    bySector.set(j.sectorId, arr);
  }
  return [...bySector.entries()]
    .map(([sectorId, list]) => ({
      sectorId,
      sectorName: sectorNameById.get(sectorId) ?? "Other",
      titles: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.sectorName.localeCompare(b.sectorName));
}

// Changing the sector keeps the job title only when it belongs to the new sector.
export function nextOnSectorChange(
  jobTitles: JobTitleOption[],
  current: { sectorId: string; jobTitleId: string },
  nextSectorId: string,
): { sectorId: string; jobTitleId: string } {
  const jt = jobTitles.find((j) => j.id === current.jobTitleId);
  const keepJobTitle = jt && jt.sectorId === nextSectorId;
  return { sectorId: nextSectorId, jobTitleId: keepJobTitle ? current.jobTitleId : "" };
}

// Job titles map to a sector, so choosing a job title fills in its sector. Clearing the job title
// leaves the sector as it is.
export function nextOnJobTitleChange(
  jobTitles: JobTitleOption[],
  current: { sectorId: string; jobTitleId: string },
  nextJobTitleId: string,
): { sectorId: string; jobTitleId: string } {
  if (!nextJobTitleId) return { sectorId: current.sectorId, jobTitleId: "" };
  const jt = jobTitles.find((j) => j.id === nextJobTitleId);
  return { jobTitleId: nextJobTitleId, sectorId: jt ? jt.sectorId : current.sectorId };
}

interface DirectoryJobTitleFieldsProps {
  idPrefix: string;
  sectors: TaxonomyOption[];
  jobTitles: JobTitleOption[];
  sectorId: string;
  jobTitleId: string;
  disabled?: boolean;
  labelStyle: CSSProperties;
  selectStyle: CSSProperties;
  hintColor: string;
  onChange: (next: { sectorId: string; jobTitleId: string }) => void;
}

// The optional Sector and Job title selects, the same pair the member self-edit form shows. Used by
// the admin edit drawer so an admin can set a profile's job title, which it could only keep before.
export function DirectoryJobTitleFields(props: DirectoryJobTitleFieldsProps) {
  const { idPrefix, sectors, jobTitles, sectorId, jobTitleId, disabled, labelStyle, selectStyle, hintColor, onChange } = props;
  const groups = groupJobTitlesBySector(sectors, jobTitles);
  const current = { sectorId, jobTitleId };
  const select = { ...selectStyle, cursor: disabled ? "not-allowed" : "pointer" };
  return (
    <>
      <div>
        <label style={labelStyle} htmlFor={`${idPrefix}-sector`}>Sector (optional)</label>
        <select
          id={`${idPrefix}-sector`}
          value={sectorId}
          disabled={disabled}
          onChange={(e) => onChange(nextOnSectorChange(jobTitles, current, e.target.value))}
          style={select}
        >
          <option value="">Not set</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle} htmlFor={`${idPrefix}-jobtitle`}>Job title (optional)</label>
        <select
          id={`${idPrefix}-jobtitle`}
          value={jobTitleId}
          disabled={disabled}
          onChange={(e) => onChange(nextOnJobTitleChange(jobTitles, current, e.target.value))}
          style={select}
        >
          <option value="">Not set</option>
          {groups.map((group) => (
            <optgroup key={group.sectorId} label={group.sectorName}>
              {group.titles.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <div style={{ fontSize: 11, color: hintColor, marginTop: 5, lineHeight: 1.5 }}>
          Choosing a job title fills in its sector. Both are optional.
        </div>
      </div>
    </>
  );
}
