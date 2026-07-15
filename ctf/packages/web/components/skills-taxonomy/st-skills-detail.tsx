"use client";

import { ChevronRight, Hash, Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsTaxonomyTokens, type StJobTitle, type StSector, type StSkill } from "./st-shared";

export function SkillsTaxonomySkillsDetail({
  sector,
  jobTitle,
  skills,
  search,
  onSearch,
}: {
  sector: StSector | null;
  jobTitle: StJobTitle | null;
  skills: StSkill[];
  search: string;
  onSearch: (value: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsTaxonomyTokens(theme);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
        <Search size={16} color={t.MUTED} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search skills in this role…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: t.TITLE }}
        />
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: t.MUTED, flexWrap: "wrap" }}>
          <span>{sector?.name ?? "Sectors"}</span><ChevronRight size={14} />
          <span>{jobTitle?.name ?? "Job Titles"}</span><ChevronRight size={14} />
          <span style={{ color: t.TITLE, fontWeight: 600 }}>Skills</span>
        </div>

        {!jobTitle ? (
          <div style={{ color: t.MUTED, fontSize: 14 }}>Select a job title to view its skills.</div>
        ) : skills.length === 0 ? (
          <div style={{ color: t.MUTED, fontSize: 14 }}>No skills recorded for this role yet.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {skills.map((sk) => (
              <span key={sk.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, fontSize: 13, color: t.ACCENT, fontWeight: 500 }}>
                <Hash size={12} /> {sk.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
