"use client";

// STATE: Authenticated, taxonomy not yet populated. Ported from
// design/.../survivor-hub/SkillsTaxonomyEmpty.tsx.
import { Award, Briefcase, Layers } from "lucide-react";
import { BG, BORDER, BRAND, SUBTLE, SURFACE, TEXT } from "./st-shared";

const LEVELS = [
  { icon: Briefcase, label: "Sectors", desc: "Top-level industry groups" },
  { icon: Award, label: "Job Titles", desc: "Roles within each sector" },
  { icon: Layers, label: "Skills", desc: "Competencies per role" },
];

export function SkillsTaxonomyEmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter',system-ui", color: TEXT, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 28px", gap: 12, background: "#0D0F14", flexShrink: 0 }}>
        <Layers size={18} color={BRAND} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Skills Taxonomy</div>
          <div style={{ fontSize: 12, color: SUBTLE }}>3-level hierarchy — sectors, job titles, skills</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 64px" }}>
        <div style={{ maxWidth: 520, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ width: 88, height: 88, borderRadius: 24, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers size={42} style={{ color: BRAND, opacity: 0.6 }} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: TEXT, marginBottom: 10 }}>No taxonomy data yet</div>
            <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7 }}>
              The skills taxonomy hasn&apos;t been populated. {isAdmin
                ? "Add the first sector to begin building the 3-level hierarchy."
                : "An admin needs to add the first sector to begin building the 3-level hierarchy."}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 360 }}>
            {LEVELS.map(({ icon: Icon, label, desc }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: "left" }}>
                <Icon size={18} color={BRAND} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{label}</div>
                  <div style={{ fontSize: 11, color: SUBTLE }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          {isAdmin && (
            <a href="/admin/skills-taxonomy" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: BRAND, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
              Manage taxonomy
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
