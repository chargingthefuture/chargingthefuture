"use client";

import { useTheme } from "@/hooks/useTheme";
import { countLabel, getSkillsTaxonomyTokens, sectorColor, type StSector } from "./st-shared";

export function SkillsTaxonomySectorsColumn({
  sectors,
  selectedSectorId,
  onSelect,
}: {
  sectors: StSector[];
  selectedSectorId: string | null;
  onSelect: (sectorId: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsTaxonomyTokens(theme);
  return (
    <aside style={{ width: "100%", background: t.HEADER, borderRight: "none", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 4 }}>📚 Skills Taxonomy</div>
        <div style={{ fontSize: 12, color: t.FAINT, lineHeight: 1.5 }}>3-level hierarchy browser</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#374151", textTransform: "uppercase", padding: "4px 10px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Sectors ({sectors.length})</span>
        </div>
        {sectors.map((s, i) => {
          const color = sectorColor(i);
          const selected = s.id === selectedSectorId;
          return (
            <button key={s.id} onClick={() => onSelect(s.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px", borderRadius: 8, cursor: "pointer", background: selected ? `${color}18` : "transparent", borderLeft: selected ? `2px solid ${color}` : "2px solid transparent", marginBottom: 2, border: "none", textAlign: "left" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: selected ? t.TITLE : t.SUBTLE, fontWeight: selected ? 600 : 400 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: t.MUTED }}>{countLabel(s.jobTitles.length, "title")}</div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
