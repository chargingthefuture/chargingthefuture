"use client";

import { Briefcase, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { countLabel, getSkillsTaxonomyTokens, type StJobTitle, type StSector } from "./st-shared";

export function SkillsTaxonomyTitlesColumn({
  sector,
  selectedJobTitleId,
  onSelect,
  isAdmin,
}: {
  sector: StSector | null;
  selectedJobTitleId: string | null;
  onSelect: (jobTitleId: string) => void;
  isAdmin: boolean;
}) {
  const jobTitles: StJobTitle[] = sector?.jobTitles ?? [];
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getSkillsTaxonomyTokens(theme);
  return (
    <aside style={{ width: isMobile ? "100%" : 260, background: t.HEADER, borderRight: isMobile ? "none" : `1px solid ${t.BORDER_SOLID}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>Job Titles</div>
          <div style={{ fontSize: 11, color: t.MUTED }}>{sector ? `${sector.name} sector` : "Select a sector"}</div>
        </div>
        {isAdmin && sector && (
          <a href="/admin/skills-taxonomy" title="Manage taxonomy" style={{ width: 28, height: 28, borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none" }}><Plus size={14} /></a>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
        {!sector ? (
          <div style={{ padding: "8px 10px", fontSize: 12, color: t.MUTED }}>Select a sector to view its job titles.</div>
        ) : jobTitles.length === 0 ? (
          <div style={{ padding: "8px 10px", fontSize: 12, color: t.MUTED }}>No job titles in this sector yet.</div>
        ) : (
          jobTitles.map((jt) => {
            const selected = jt.id === selectedJobTitleId;
            return (
              <button key={jt.id} onClick={() => onSelect(jt.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 10px", borderRadius: 8, cursor: "pointer", background: selected ? `${t.ACCENT}14` : "transparent", marginBottom: 4, border: selected ? `1px solid ${t.ACCENT}30` : "1px solid transparent", textAlign: "left" }}>
                <Briefcase size={14} color={selected ? t.ACCENT : t.MUTED} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: selected ? t.TITLE : t.SUBTLE, fontWeight: selected ? 600 : 400 }}>{jt.name}</div>
                  <div style={{ fontSize: 10, color: t.MUTED }}>{countLabel(jt.skills.length, "skill")}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
