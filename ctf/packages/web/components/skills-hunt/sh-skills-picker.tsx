"use client";

import { useEffect, useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { COLOR, groupTaxonomyBySector, type TaxonomyFlattenedRow } from "./sh-shared";

type TaxonomyLoadState =
  | { status: "loading" }
  | { status: "ready"; categories: Record<string, string[]> }
  | { status: "error" };

// Fetch the canonical skills taxonomy once on mount and group it by sector for the picker.
// On error or an empty result the picker still renders the free-text proposed-skills box so a
// scout can proceed.
function useTaxonomy(): TaxonomyLoadState {
  const [state, setState] = useState<TaxonomyLoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/skills-taxonomy/flattened");
        if (!res.ok) throw new Error(`Taxonomy request failed (${res.status})`);
        const data = (await res.json()) as { items?: TaxonomyFlattenedRow[] };
        if (!active) return;
        setState({ status: "ready", categories: groupTaxonomyBySector(data.items ?? []) });
      } catch {
        if (active) setState({ status: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

interface SkillsPickerProps {
  skills: string[];
  proposedSkills: string[];
  freeText: string;
  openCategory: string | null;
  canAddMore: boolean;
  allSkillCount: number;
  onToggleSkill: (s: string) => void;
  onRemoveProposed: (s: string) => void;
  onOpenCategory: (c: string | null) => void;
  onFreeText: (v: string) => void;
  onAddProposed: () => void;
}

function SelectedChips({ skills, proposedSkills, onToggleSkill, onRemoveProposed }: Pick<SkillsPickerProps, "skills" | "proposedSkills" | "onToggleSkill" | "onRemoveProposed">) {
  if (skills.length === 0 && proposedSkills.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {skills.map((s) => (
        <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, fontSize: 12, color: COLOR, fontWeight: 600 }}>
          {s}
          <button type="button" aria-label={`Remove ${s}`} onClick={() => onToggleSkill(s)} style={{ background: "none", border: "none", color: COLOR, cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={11} /></button>
        </span>
      ))}
      {proposedSkills.map((s) => (
        <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", fontSize: 12, color: "#FBBF24", fontWeight: 600 }}>
          {s} <span style={{ fontSize: 10, opacity: 0.7 }}>✎</span>
          <button type="button" aria-label={`Remove ${s}`} onClick={() => onRemoveProposed(s)} style={{ background: "none", border: "none", color: "#FBBF24", cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={11} /></button>
        </span>
      ))}
    </div>
  );
}

function CategoryRow({ category, categorySkills, skills, isOpen, canAddMore, onOpenCategory, onToggleSkill }: {
  category: string;
  categorySkills: string[];
  skills: string[];
  isOpen: boolean;
  canAddMore: boolean;
  onOpenCategory: (c: string | null) => void;
  onToggleSkill: (s: string) => void;
}) {
  const selectedCount = categorySkills.filter((s) => skills.includes(s)).length;
  return (
    <div>
      <button type="button" onClick={() => onOpenCategory(isOpen ? null : category)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: isOpen ? `${COLOR}10` : "rgba(255,255,255,0.02)", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: isOpen ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 600 }}>
        <span>{category}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectedCount > 0 && (
            <span style={{ fontSize: 11, background: `${COLOR}25`, color: COLOR, borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>{selectedCount} selected</span>
          )}
          <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>
      {isOpen && (
        <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 7, background: "rgba(255,255,255,0.01)" }}>
          {categorySkills.map((s) => {
            const selected = skills.includes(s);
            return (
              <button key={s} type="button" onClick={() => { if (canAddMore || selected) onToggleSkill(s); }}
                style={{ padding: "4px 12px", borderRadius: 20, background: selected ? `${COLOR}25` : "rgba(255,255,255,0.04)", border: `1px solid ${selected ? COLOR + "60" : "rgba(255,255,255,0.08)"}`, color: selected ? COLOR : "#9CA3AF", fontSize: 12, fontWeight: selected ? 700 : 400, cursor: canAddMore || selected ? "pointer" : "default", opacity: !canAddMore && !selected ? 0.4 : 1 }}>
                {selected ? "✓ " : ""}{s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SkillsPicker(props: SkillsPickerProps) {
  const { skills, proposedSkills, freeText, openCategory, canAddMore, allSkillCount, onToggleSkill, onRemoveProposed, onOpenCategory, onFreeText, onAddProposed } = props;
  const taxonomy = useTaxonomy();
  const categories = taxonomy.status === "ready" ? taxonomy.categories : {};
  const hasCategories = Object.keys(categories).length > 0;
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
        Skills <span style={{ color: COLOR }}>*</span>
        <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 400, marginLeft: 6 }}>pick from taxonomy (max 10)</span>
      </label>

      <SelectedChips skills={skills} proposedSkills={proposedSkills} onToggleSkill={onToggleSkill} onRemoveProposed={onRemoveProposed} />

      {canAddMore && taxonomy.status === "loading" && (
        <div style={{ fontSize: 12, color: "#6B7280", padding: "10px 0" }}>Loading skills…</div>
      )}

      {canAddMore && taxonomy.status === "error" && (
        <div style={{ fontSize: 12, color: "#F59E0B", padding: "6px 0", marginBottom: 4 }}>Could not load the skills list — add skills as free text below.</div>
      )}

      {canAddMore && taxonomy.status === "ready" && hasCategories && (
        <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
          {Object.entries(categories).map(([category, categorySkills]) => (
            <CategoryRow key={category} category={category} categorySkills={categorySkills} skills={skills} isOpen={openCategory === category} canAddMore={canAddMore} onOpenCategory={onOpenCategory} onToggleSkill={onToggleSkill} />
          ))}
        </div>
      )}

      {canAddMore && (
        <div>
          <div style={{ fontSize: 11, color: "#4B5563", marginBottom: 6 }}>Don&apos;t see what you need? Add free-text skills (comma or newline separated — each ≤ 40 chars):</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={freeText}
              onChange={(e) => onFreeText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddProposed(); } }}
              aria-label="Add free-text skills"
              placeholder="e.g. Tie-dye, Beekeeping, Kintsugi…"
              style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: "#E8EAF0", outline: "none" }}
            />
            <button type="button" onClick={onAddProposed} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Add</button>
          </div>
          <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>Yellow chips = proposed skills — admin can promote them to the taxonomy later.</div>
        </div>
      )}

      {!canAddMore && <div style={{ fontSize: 11, color: "#6B7280", padding: "6px 0" }}>Maximum 10 skills reached.</div>}
      <div style={{ fontSize: 11, color: "#4B5563", marginTop: 6 }}>{allSkillCount}/10 skills added</div>
    </div>
  );
}
