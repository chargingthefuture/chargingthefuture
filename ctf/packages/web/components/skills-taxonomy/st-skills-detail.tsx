"use client";

import { ChevronRight, Hash, Plus, Search } from "lucide-react";
import { BORDER, BRAND, SUBTLE, TEXT, type StJobTitle, type StSector, type StSkill } from "./st-shared";

export function SkillsTaxonomySkillsDetail({
  sector,
  jobTitle,
  skills,
  search,
  onSearch,
  isAdmin,
}: {
  sector: StSector | null;
  jobTitle: StJobTitle | null;
  skills: StSkill[];
  search: string;
  onSearch: (value: string) => void;
  isAdmin: boolean;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <header style={{ height: 56, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
        <Search size={16} color={SUBTLE} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search skills in this role…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: TEXT }}
        />
        {isAdmin && (
          <a href="/admin/skills-taxonomy" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, color: BRAND, fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
            <Plus size={14} /> Add Skill
          </a>
        )}
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: SUBTLE, flexWrap: "wrap" }}>
          <span>{sector?.name ?? "Sectors"}</span><ChevronRight size={14} />
          <span>{jobTitle?.name ?? "Job Titles"}</span><ChevronRight size={14} />
          <span style={{ color: TEXT, fontWeight: 600 }}>Skills</span>
        </div>

        {!jobTitle ? (
          <div style={{ color: SUBTLE, fontSize: 14 }}>Select a job title to view its skills.</div>
        ) : skills.length === 0 ? (
          <div style={{ color: SUBTLE, fontSize: 14 }}>No skills recorded for this role yet.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {skills.map((sk) => (
              <span key={sk.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, fontSize: 13, color: BRAND, fontWeight: 500 }}>
                <Hash size={12} /> {sk.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
