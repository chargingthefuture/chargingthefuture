"use client";

import { useState } from "react";
import {
  BookOpen, Search, ChevronDown,
  Bell, Settings, Plus, Layers, TrendingUp, Shield,
} from "lucide-react";
import type { TaxonomyHierarchySector } from "lib/skills-taxonomy/types";

// API: GET /api/skills-taxonomy/hierarchy  → hierarchy[]
// API: POST /api/skills-taxonomy/admin/sectors  (admin only)
// API: POST /api/skills-taxonomy/admin/job-titles  (admin only)
// API: POST /api/skills-taxonomy/admin/skills  (admin only)

const BRAND = "#8B5CF6";
const bg = "#0F1117";
const surface = "#161B27";
const border = "#1E2A3A";
const textColor = "#F9FAFB";
const subtle = "#6B7280";

const SECTOR_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6",
  "#06B6D4", "#F97316", "#22C55E", "#A855F7", "#EF4444",
];

type Props = {
  hierarchy: TaxonomyHierarchySector[];
  totalSkillCount: number;
  isAdmin: boolean;
};

export function SkillsTaxonomyBrowser({ hierarchy, totalSkillCount, isAdmin }: Props) {
  const [selectedSectorId, setSelectedSectorId] = useState(hierarchy[0]?.id ?? "");
  const [openJobTitleId, setOpenJobTitleId] = useState<string | null>(hierarchy[0]?.jobTitles[0]?.id ?? null);
  const [search, setSearch] = useState("");

  const selectedSector = hierarchy.find((s) => s.id === selectedSectorId) ?? hierarchy[0];
  const filteredSectors = search
    ? hierarchy.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : hierarchy;

  const recentlyAdded = hierarchy
    .flatMap((s) => s.jobTitles.flatMap((j) => j.skills.map((sk) => ({ skill: sk.name, sector: s.name }))))
    .slice(0, 3);

  return (
    <div style={{ display: "flex", height: "100vh", background: bg, fontFamily: "'Inter', system-ui, sans-serif", color: textColor, overflow: "hidden" }}>

      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <BookOpen size={20} color={BRAND} />
        </div>
        {[Search, Layers, TrendingUp, Shield].map((Icon, i) => (
          <button key={i} style={{ width: 44, height: 44, borderRadius: 12, background: i === 0 ? `${BRAND}20` : "transparent", border: i === 0 ? `1px solid ${BRAND}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: i === 0 ? BRAND : subtle }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle }}><Bell size={18} /></button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle }}><Settings size={18} /></button>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${BRAND}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: BRAND }}>S</div>
      </aside>

      {/* Sector sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: subtle, textTransform: "uppercase", marginBottom: 4 }}>📚 Skills Taxonomy</div>
          <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5, marginBottom: 12 }}>Browse sectors, job titles, and skills</div>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills…"
              style={{ width: "100%", padding: "7px 10px 7px 28px", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#374151", textTransform: "uppercase", padding: "4px 8px 8px" }}>Sectors ({filteredSectors.length})</div>
          {filteredSectors.map(({ id, name, jobTitles }, idx) => {
            const color = SECTOR_COLORS[idx % SECTOR_COLORS.length];
            const skillCount = jobTitles.reduce((a, j) => a + j.skills.length, 0);
            return (
              <button key={id} onClick={() => setSelectedSectorId(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: selectedSectorId === id ? `${BRAND}18` : "transparent", borderLeft: selectedSectorId === id ? `2px solid ${BRAND}` : "2px solid transparent", marginLeft: 2, marginBottom: 2, border: "none", textAlign: "left" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: selectedSectorId === id ? textColor : "#9CA3AF", flex: 1 }}>{name}</span>
                <span style={{ fontSize: 11, color: selectedSectorId === id ? BRAND : "#4B5563", fontWeight: 600 }}>{skillCount}</span>
              </button>
            );
          })}
        </div>
        {isAdmin && (
          <div style={{ padding: 12, borderTop: `1px solid ${border}` }}>
            <button style={{ width: "100%", padding: "9px", borderRadius: 8, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, color: BRAND, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={13} /> Add Sector
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <BookOpen size={18} color={BRAND} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>{selectedSector?.name ?? "—"}</div>
            <div style={{ fontSize: 12, color: subtle }}>Skills taxonomy browser</div>
          </div>
          {isAdmin && (
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, background: `${BRAND}15`, border: `1px solid ${BRAND}30`, color: BRAND, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={14} /> Add Job Title
            </button>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {selectedSector && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Job Titles", value: String(selectedSector.jobTitles.length), color: BRAND },
                  { label: "Total Skills", value: String(selectedSector.jobTitles.reduce((a, j) => a + j.skills.length, 0)), color: "#22C55E" },
                  { label: "Sector", value: selectedSector.name, color: "#06B6D4" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${border}` }}>
                    <div style={{ fontSize: 11, color: subtle, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
                {selectedSector.jobTitles.map(({ id: jtId, name: jtName, skills }, idx) => (
                  <div key={jtId}>
                    <button
                      onClick={() => setOpenJobTitleId(openJobTitleId === jtId ? null : jtId)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: openJobTitleId === jtId ? `${BRAND}10` : idx % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent", border: "none", borderBottom: `1px solid ${border}`, cursor: "pointer", color: openJobTitleId === jtId ? BRAND : textColor, fontSize: 14, fontWeight: 600, textAlign: "left" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <ChevronDown size={14} style={{ transform: openJobTitleId === jtId ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", color: openJobTitleId === jtId ? BRAND : subtle }} />
                        {jtName}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: openJobTitleId === jtId ? BRAND : subtle, background: openJobTitleId === jtId ? `${BRAND}15` : "rgba(255,255,255,0.05)", borderRadius: 10, padding: "2px 8px", fontWeight: 600 }}>{skills.length} skills</span>
                        {isAdmin && <Plus size={13} color={subtle} />}
                      </div>
                    </button>
                    {openJobTitleId === jtId && (
                      <div style={{ padding: "12px 18px 16px", background: "rgba(255,255,255,0.01)", borderBottom: `1px solid ${border}` }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {skills.map((sk) => (
                            <span key={sk.id} style={{ padding: "5px 12px", borderRadius: 20, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, fontSize: 12, color: BRAND, fontWeight: 500, cursor: isAdmin ? "pointer" : "default" }}>
                              {sk.name}
                            </span>
                          ))}
                          {isAdmin && (
                            <button style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: `1px dashed ${border}`, fontSize: 12, color: subtle, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                              <Plus size={11} /> Add skill
                            </button>
                          )}
                          {skills.length === 0 && <span style={{ fontSize: 12, color: subtle }}>No skills yet.</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {selectedSector.jobTitles.length === 0 && (
                  <div style={{ padding: "24px 18px", fontSize: 13, color: subtle }}>No job titles in this sector yet.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right rail */}
      <aside style={{ width: 280, borderLeft: `1px solid ${border}`, background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Taxonomy Stats</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Sectors", value: String(hierarchy.length), color: BRAND },
            { label: "Job Titles", value: String(hierarchy.reduce((a, s) => a + s.jobTitles.length, 0)), color: "#22C55E" },
            { label: "Total Skills", value: String(totalSkillCount), color: "#06B6D4" },
            { label: "Active", value: String(hierarchy.filter((s) => s.isActive).length), color: "#F59E0B" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${border}`, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: subtle, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Recently Added</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {recentlyAdded.length === 0 ? (
            <div style={{ fontSize: 12, color: subtle }}>No skills yet.</div>
          ) : recentlyAdded.map(({ skill, sector }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: textColor }}>{skill}</div>
                <div style={{ fontSize: 11, color: subtle }}>{sector}</div>
              </div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: `${BRAND}08`, border: `1px solid ${BRAND}20` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: BRAND, marginBottom: 8 }}>Admin Actions</div>
            {["Add skill", "Add job title", "Add sector"].map((action) => (
              <button key={action} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, color: textColor, fontSize: 12, cursor: "pointer", marginBottom: 6, textAlign: "left" }}>
                <Plus size={12} color={BRAND} /> {action}
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
