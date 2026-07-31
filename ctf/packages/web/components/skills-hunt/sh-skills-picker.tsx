"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ChevronDown, Search } from "lucide-react";
import { groupSkillsByOccupation, groupTaxonomyBySector, type TaxonomyFlattenedRow } from "./sh-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSkillsHuntTokens } from './sh-shared';

type TaxonomyLoadState =
  | { status: "loading" }
  | { status: "ready"; categories: Record<string, string[]>; occupations: Record<string, string[]> }
  | { status: "error" };

// Cache the grouped taxonomy for the page session so the picker never has to show "Loading…"
// again after the first fetch. Re-showing the loading state would collapse the category list,
// which on a phone makes the page shrink and the scroll jump — the exact symptom of selecting a
// skill re-rendering the picker. Both groupings come from the one flattened fetch.
let cachedCategories: Record<string, string[]> | null = null;
let cachedOccupations: Record<string, string[]> | null = null;

// Fetch the canonical skills taxonomy once and group it by sector for the picker. On error or an
// empty result the picker still renders the free-text proposed-skills box so a scout can proceed.
function useTaxonomy(): TaxonomyLoadState {
  const [state, setState] = useState<TaxonomyLoadState>(
    cachedCategories && cachedOccupations
      ? { status: "ready", categories: cachedCategories, occupations: cachedOccupations }
      : { status: "loading" },
  );

  useEffect(() => {
    if (cachedCategories && cachedOccupations) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/skills-taxonomy/flattened");
        if (!res.ok) throw new Error(`Taxonomy request failed (${res.status})`);
        const data = (await res.json()) as { items?: TaxonomyFlattenedRow[] };
        if (!active) return;
        const rows = data.items ?? [];
        const categories = groupTaxonomyBySector(rows);
        const occupations = groupSkillsByOccupation(rows);
        cachedCategories = categories;
        cachedOccupations = occupations;
        setState({ status: "ready", categories, occupations });
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

// Read the grouped taxonomy out of the load state, defaulting to empty groupings whenever the
// fetch is not yet ready (or failed). Keeps the picker's ternaries out of its render body.
function readTaxonomy(taxonomy: TaxonomyLoadState): {
  categories: Record<string, string[]>;
  occupations: Record<string, string[]>;
} {
  if (taxonomy.status === "ready") {
    return { categories: taxonomy.categories, occupations: taxonomy.occupations };
  }
  return { categories: {}, occupations: {} };
}

interface SkillsPickerProps {
  skills: string[];
  proposedSkills: string[];
  freeText: string;
  openCategory: string | null;
  canAddMore: boolean;
  allSkillCount: number;
  onToggleSkill: (s: string) => void;
  onAddOccupationSkills: (skillNames: string[]) => void;
  onRemoveProposed: (s: string) => void;
  onOpenCategory: (c: string | null) => void;
  onFreeText: (v: string) => void;
  onAddProposed: () => void;
}

function SelectedChips({ skills, proposedSkills, onToggleSkill, onRemoveProposed }: Pick<SkillsPickerProps, "skills" | "proposedSkills" | "onToggleSkill" | "onRemoveProposed">) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  if (skills.length === 0 && proposedSkills.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {skills.map((s) => (
        <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}40`, fontSize: 12, color: t.ACCENT, fontWeight: 600 }}>
          {s}
          <button type="button" aria-label={`Remove ${s}`} onClick={() => onToggleSkill(s)} style={{ background: "none", border: "none", color: t.ACCENT, cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={11} /></button>
        </span>
      ))}
      {proposedSkills.map((s) => (
        <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", fontSize: 12, color: t.ACCENT, fontWeight: 600 }}>
          {s} <span style={{ fontSize: 10, opacity: 0.7 }}>✎</span>
          <button type="button" aria-label={`Remove ${s}`} onClick={() => onRemoveProposed(s)} style={{ background: "none", border: "none", color: t.ACCENT, cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={11} /></button>
        </span>
      ))}
    </div>
  );
}

// One selectable taxonomy skill chip — shared by the sector accordion and the
// keyword-search results so both look and behave identically.
function SkillChip({ skill, selected, canAddMore, onToggleSkill }: {
  skill: string;
  selected: boolean;
  canAddMore: boolean;
  onToggleSkill: (s: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <button type="button" onClick={() => { if (canAddMore || selected) onToggleSkill(skill); }}
      style={{ padding: "4px 12px", borderRadius: 20, background: selected ? `${t.ACCENT}25` : t.INPUT_BG, border: `1px solid ${selected ? t.ACCENT + "60" : t.BORDER_STRONG}`, color: selected ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: selected ? 700 : 400, cursor: canAddMore || selected ? "pointer" : "default", opacity: !canAddMore && !selected ? 0.4 : 1 }}>
      {selected ? "✓ " : ""}{skill}
    </button>
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
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const selectedCount = categorySkills.filter((s) => skills.includes(s)).length;
  return (
    <div>
      <button type="button" onClick={() => onOpenCategory(isOpen ? null : category)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: isOpen ? `${t.ACCENT}10` : "rgba(255,255,255,0.02)", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: isOpen ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600 }}>
        <span>{category}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectedCount > 0 && (
            <span style={{ fontSize: 11, background: `${t.ACCENT}25`, color: t.ACCENT, borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>{selectedCount} selected</span>
          )}
          <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>
      {isOpen && (
        <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 7, background: "rgba(255,255,255,0.01)" }}>
          {categorySkills.map((s) => (
            <SkillChip key={s} skill={s} selected={skills.includes(s)} canAddMore={canAddMore} onToggleSkill={onToggleSkill} />
          ))}
        </div>
      )}
    </div>
  );
}

// Optional profession prefill — fills in a whole occupation's skills at once. Renders nothing
// until the taxonomy is loaded and at least one occupation is known.
function OccupationPrefill({ occupations, canAddMore, onAddOccupationSkills }: {
  occupations: Record<string, string[]>;
  canAddMore: boolean;
  onAddOccupationSkills: (skillNames: string[]) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const occupationNames = Object.keys(occupations);
  if (occupationNames.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <label htmlFor="sh-occupation-prefill" style={{ fontSize: 11, color: t.SUBTLE, display: "block", marginBottom: 4 }}>
        Know their profession? Add its skills <span style={{ color: t.FAINT }}>(optional — fills the skills in for you)</span>
      </label>
      <select
        id="sh-occupation-prefill"
        value=""
        disabled={!canAddMore}
        onChange={(e) => { const occ = e.target.value; if (occ && occupations[occ]) onAddOccupationSkills(occupations[occ]); }}
        style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", cursor: canAddMore ? "pointer" : "default", opacity: canAddMore ? 1 : 0.5 }}
      >
        <option value="">Select a profession…</option>
        {occupationNames.map((occ) => (
          <option key={occ} value={occ}>{occ}</option>
        ))}
      </select>
    </div>
  );
}

// The loading / error status line for the taxonomy fetch. Renders nothing once the taxonomy
// is ready (the accordion and search take over from there).
function TaxonomyStatus({ taxonomy }: { taxonomy: TaxonomyLoadState }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  if (taxonomy.status === "loading") {
    return <div style={{ fontSize: 12, color: t.MUTED, padding: "10px 0" }}>Loading skills…</div>;
  }
  if (taxonomy.status === "error") {
    return <div style={{ fontSize: 12, color: "#F59E0B", padding: "6px 0", marginBottom: 4 }}>Could not load the skills list — add skills as free text below.</div>;
  }
  return null;
}

// Keyword search box — only shown once the taxonomy has categories to search across.
function SkillSearch({ taxonomy, hasCategories, search, setSearch }: {
  taxonomy: TaxonomyLoadState;
  hasCategories: boolean;
  search: string;
  setSearch: (v: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  if (taxonomy.status !== "ready" || !hasCategories) return null;
  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.FAINT, pointerEvents: "none" }} />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search skills by keyword"
        placeholder="Search skills by keyword…"
        style={{ width: "100%", padding: "8px 32px 8px 34px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", boxSizing: "border-box" }}
      />
      {search && (
        <button type="button" aria-label="Clear skill search" onClick={() => setSearch("")}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.FAINT, cursor: "pointer", padding: 4, lineHeight: 1 }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// When searching, a flat cross-sector result list replaces the accordion.
function SearchResults({ taxonomy, hasCategories, query, search, matches, skills, canAddMore, onToggleSkill }: {
  taxonomy: TaxonomyLoadState;
  hasCategories: boolean;
  query: string;
  search: string;
  matches: string[];
  skills: string[];
  canAddMore: boolean;
  onToggleSkill: (s: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  if (taxonomy.status !== "ready" || !hasCategories || !query) return null;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: t.MUTED }}>No skills match “{search.trim()}”. Add it as a free-text skill below.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {matches.map((s) => (
            <SkillChip key={s} skill={s} selected={skills.includes(s)} canAddMore={canAddMore} onToggleSkill={onToggleSkill} />
          ))}
        </div>
      )}
    </div>
  );
}

// The sector accordion — shown when the taxonomy is ready and no keyword search is active.
function CategoryAccordion({ taxonomy, hasCategories, query, categories, skills, openCategory, canAddMore, onOpenCategory, onToggleSkill }: {
  taxonomy: TaxonomyLoadState;
  hasCategories: boolean;
  query: string;
  categories: Record<string, string[]>;
  skills: string[];
  openCategory: string | null;
  canAddMore: boolean;
  onOpenCategory: (c: string | null) => void;
  onToggleSkill: (s: string) => void;
}) {
  if (taxonomy.status !== "ready" || !hasCategories || query) return null;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
      {Object.entries(categories).map(([category, categorySkills]) => (
        <CategoryRow key={category} category={category} categorySkills={categorySkills} skills={skills} isOpen={openCategory === category} canAddMore={canAddMore} onOpenCategory={onOpenCategory} onToggleSkill={onToggleSkill} />
      ))}
    </div>
  );
}

// Free-text skill entry — proposed skills an admin can later promote into the taxonomy.
// Only shown while there is still room under the 10-skill cap.
function FreeTextAdder({ canAddMore, freeText, onFreeText, onAddProposed }: {
  canAddMore: boolean;
  freeText: string;
  onFreeText: (v: string) => void;
  onAddProposed: () => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  if (!canAddMore) return null;
  return (
    <div>
      <div style={{ fontSize: 11, color: t.FAINT, marginBottom: 6 }}>Don&apos;t see what you need? Add free-text skills (comma or newline separated — each ≤ 40 chars):</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={freeText}
          onChange={(e) => onFreeText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddProposed(); } }}
          aria-label="Add free-text skills"
          placeholder="e.g. Tie-dye, Beekeeping, Kintsugi…"
          style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none" }}
        />
        <button type="button" onClick={onAddProposed} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: t.ACCENT, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Add</button>
      </div>
      <div style={{ fontSize: 11, color: t.FAINT, marginTop: 4 }}>Yellow chips = proposed skills — admin can promote them to the taxonomy later.</div>
    </div>
  );
}

// The cap notice (once 10 skills are reached) plus the running count.
function FooterStatus({ canAddMore, allSkillCount }: {
  canAddMore: boolean;
  allSkillCount: number;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <>
      {!canAddMore && <div style={{ fontSize: 11, color: t.MUTED, padding: "6px 0" }}>Maximum 10 skills reached.</div>}
      <div style={{ fontSize: 11, color: t.FAINT, marginTop: 6 }}>{allSkillCount}/10 skills added</div>
    </>
  );
}

export function SkillsPicker(props: SkillsPickerProps) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  const { skills, proposedSkills, freeText, openCategory, canAddMore, allSkillCount, onToggleSkill, onAddOccupationSkills, onRemoveProposed, onOpenCategory, onFreeText, onAddProposed } = props;
  const taxonomy = useTaxonomy();
  const { categories, occupations } = readTaxonomy(taxonomy);
  const hasCategories = Object.keys(categories).length > 0;

  // Keyword search across every sector — a flat, de-duplicated skill list filtered
  // by substring. Local UI state only; it does not touch the form model.
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    for (const list of Object.values(categories)) for (const s of list) set.add(s);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories]);
  const matches = query ? allSkills.filter((s) => s.toLowerCase().includes(query)) : [];

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>
        Skills <span style={{ color: t.ACCENT }}>*</span>
        <span style={{ fontSize: 11, color: t.FAINT, fontWeight: 400, marginLeft: 6 }}>pick from taxonomy (max 10)</span>
      </div>

      <SelectedChips skills={skills} proposedSkills={proposedSkills} onToggleSkill={onToggleSkill} onRemoveProposed={onRemoveProposed} />

      <OccupationPrefill occupations={occupations} canAddMore={canAddMore} onAddOccupationSkills={onAddOccupationSkills} />

      <TaxonomyStatus taxonomy={taxonomy} />

      <SkillSearch taxonomy={taxonomy} hasCategories={hasCategories} search={search} setSearch={setSearch} />

      <SearchResults taxonomy={taxonomy} hasCategories={hasCategories} query={query} search={search} matches={matches} skills={skills} canAddMore={canAddMore} onToggleSkill={onToggleSkill} />

      <CategoryAccordion taxonomy={taxonomy} hasCategories={hasCategories} query={query} categories={categories} skills={skills} openCategory={openCategory} canAddMore={canAddMore} onOpenCategory={onOpenCategory} onToggleSkill={onToggleSkill} />

      <FreeTextAdder canAddMore={canAddMore} freeText={freeText} onFreeText={onFreeText} onAddProposed={onAddProposed} />

      <FooterStatus canAddMore={canAddMore} allSkillCount={allSkillCount} />
    </div>
  );
}
