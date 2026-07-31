"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { DirectoryTokens } from "./shared";
import { DIRECTORY_MAX_PROPOSED_SKILL_LENGTH, DIRECTORY_MAX_PROPOSED_SKILLS } from "@/lib/directory/constants";

// The taxonomy option shapes the Directory API returns (ID-based, unlike SkillsHunt which uses
// name strings). Skills are stored and submitted as taxonomy IDs, so the picker toggles IDs and
// only resolves names for display.
type TaxonomyOption = { id: string; name: string };
type JobTitleOption = { id: string; name: string; sectorId: string };
type SkillOption = { id: string; name: string; jobTitleId: string };

// One picker entry = one skill NAME plus every taxonomy id that shares it. The taxonomy lists the
// same skill name under several occupations on purpose (Workforce matches by name), but to a member
// picking a skill those duplicates are one thing — indistinguishable and confusing. So we show the
// name once and toggle all of its ids together: picking it selects the first id; unpicking removes
// every selected id that shares the name (which also self-heals a profile that already holds two).
type SkillEntry = { name: string; ids: string[] };

// One accordion section: a sector name plus the de-duplicated skill entries grouped under it.
type SkillCategory = { sector: string; entries: SkillEntry[] };

// Skills that cannot be traced back to a sector (missing/inactive job title) still need a home in
// the accordion so they remain selectable. They go under this bucket, sorted last.
const OTHER_SECTOR = "Other";

interface DirectorySkillsPickerProps {
  tokens: DirectoryTokens;
  sectors: TaxonomyOption[];
  jobTitles: JobTitleOption[];
  skills: SkillOption[];
  loading: boolean;
  selectedSkillIds: string[];
  onToggleSkill: (id: string) => void;
  // Free-text "pending review" proposals are member-owned: the member self-edit form passes all of
  // these; the admin edit form omits them (the admin update contract has no proposedSkills), which
  // hides the free-text section entirely.
  proposedSkills?: string[];
  proposedInput?: string;
  onProposedInputChange?: (value: string) => void;
  onAddProposed?: () => void;
  onRemoveProposed?: (label: string) => void;
}

// Group the ID-based taxonomy by sector for the accordion. Within a sector, same-named skills are
// collapsed into one SkillEntry carrying all their ids (see SkillEntry), so a name shows once. Job
// titles only supply each skill's sector here; there is no extra fetch.
function useGroupedTaxonomy(sectors: TaxonomyOption[], jobTitles: JobTitleOption[], skills: SkillOption[]) {
  return useMemo(() => {
    const sectorNameById = new Map(sectors.map((s) => [s.id, s.name] as const));
    const jobTitleById = new Map(jobTitles.map((j) => [j.id, j] as const));

    // sector name -> (skill name -> ordered unique ids)
    const bySector = new Map<string, Map<string, string[]>>();

    for (const skill of skills) {
      const jobTitle = jobTitleById.get(skill.jobTitleId);
      const sectorName = jobTitle ? sectorNameById.get(jobTitle.sectorId) ?? OTHER_SECTOR : OTHER_SECTOR;

      let nameMap = bySector.get(sectorName);
      if (!nameMap) {
        nameMap = new Map();
        bySector.set(sectorName, nameMap);
      }
      const ids = nameMap.get(skill.name) ?? [];
      if (!ids.includes(skill.id)) ids.push(skill.id);
      nameMap.set(skill.name, ids);
    }

    const categories = [...bySector.entries()]
      .map(([sector, nameMap]) => ({
        sector,
        entries: [...nameMap.entries()]
          .map(([name, ids]) => ({ name, ids }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      // "Other" always sorts last; everything else alphabetically.
      .sort((a, b) => {
        if (a.sector === OTHER_SECTOR) return 1;
        if (b.sector === OTHER_SECTOR) return -1;
        return a.sector.localeCompare(b.sector);
      });

    return { categories };
  }, [sectors, jobTitles, skills]);
}

// One selectable skill chip — shared by the sector accordion and the keyword-search results so both
// look and behave identically. It represents a name-entry: active when any of its ids are selected.
function SkillChip({ entry, active, tokens, onToggleEntry }: {
  entry: SkillEntry;
  active: boolean;
  tokens: DirectoryTokens;
  onToggleEntry: (entry: SkillEntry) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggleEntry(entry)}
      aria-pressed={active}
      style={{
        padding: "5px 12px", borderRadius: 14, fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
        background: active ? `${tokens.ACCENT}20` : "transparent",
        border: `1px solid ${active ? `${tokens.ACCENT}50` : tokens.BORDER_HI}`,
        color: active ? tokens.ACCENT : tokens.SUBTLE,
      }}
    >
      {active ? "✓ " : ""}{entry.name}
    </button>
  );
}

function SectorRow({
  sector,
  entries,
  selectedIds,
  isOpen,
  tokens,
  onToggle,
  onToggleEntry,
}: {
  sector: string;
  entries: SkillEntry[];
  selectedIds: Set<string>;
  isOpen: boolean;
  tokens: DirectoryTokens;
  onToggle: () => void;
  onToggleEntry: (entry: SkillEntry) => void;
}) {
  const selectedCount = entries.filter((e) => e.ids.some((id) => selectedIds.has(id))).length;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: isOpen ? `${tokens.ACCENT}12` : "transparent", border: "none",
          borderBottom: `1px solid ${tokens.BORDER}`, cursor: "pointer", color: isOpen ? tokens.ACCENT : tokens.SUBTLE,
          fontSize: 13, fontWeight: 600,
        }}
      >
        <span>{sector}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectedCount > 0 && (
            <span style={{ fontSize: 11, background: `${tokens.ACCENT}25`, color: tokens.ACCENT, borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>
              {selectedCount} selected
            </span>
          )}
          <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>
      {isOpen && (
        <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 7 }}>
          {entries.map((e) => (
            <SkillChip key={e.name} entry={e} active={e.ids.some((id) => selectedIds.has(id))} tokens={tokens} onToggleEntry={onToggleEntry} />
          ))}
        </div>
      )}
    </div>
  );
}

// The "N selected" hint that trails the section label. Hidden when nothing is picked.
function SelectedCountBadge({ count, tokens }: { count: number; tokens: DirectoryTokens }) {
  if (count === 0) return null;
  return <span style={{ marginLeft: 8, color: tokens.ACCENT, fontWeight: 700 }}>{count} selected</span>;
}

// The row of removable picks — taxonomy skills in the app accent, proposed skills in amber. Renders
// nothing until there is at least one of either kind.
function SelectedSkillChips({ selectedNames, proposedSkills, tokens, onToggleSkill, onRemoveProposed }: {
  selectedNames: SkillEntry[];
  proposedSkills: string[];
  tokens: DirectoryTokens;
  onToggleSkill: (id: string) => void;
  onRemoveProposed?: (label: string) => void;
}) {
  if (selectedNames.length === 0 && proposedSkills.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {selectedNames.map((entry) => (
        <span key={entry.name} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: `${tokens.ACCENT}20`, border: `1px solid ${tokens.ACCENT}40`, fontSize: 12, color: tokens.ACCENT, fontWeight: 600 }}>
          {entry.name}
          <button type="button" aria-label={`Remove ${entry.name}`} onClick={() => entry.ids.forEach((id) => onToggleSkill(id))} style={{ background: "none", border: "none", color: tokens.ACCENT, cursor: "pointer", padding: 0, lineHeight: 1, display: "flex" }}>
            <X size={11} />
          </button>
        </span>
      ))}
      {proposedSkills.map((s) => (
        <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", fontSize: 12, color: "#FBBF24", fontWeight: 600 }}>
          {s} <span style={{ fontSize: 10, opacity: 0.7 }}>✎</span>
          <button type="button" aria-label={`Remove ${s}`} onClick={() => onRemoveProposed?.(s)} style={{ background: "none", border: "none", color: "#FBBF24", cursor: "pointer", padding: 0, lineHeight: 1, display: "flex" }}>
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

// "Loading skills…" line, shown only while the taxonomy fetch is in flight.
function LoadingNotice({ loading, tokens }: { loading: boolean; tokens: DirectoryTokens }) {
  if (!loading) return null;
  return <div style={{ fontSize: 12, color: tokens.MUTED, padding: "10px 0" }}>Loading skills…</div>;
}

// Shown when the fetch finished but returned no categories: the taxonomy is unavailable. The message
// differs by whether the member can fall back to free-text proposals.
function SkillsUnavailableNotice({ loading, categoryCount, allowProposed, tokens }: {
  loading: boolean;
  categoryCount: number;
  allowProposed: boolean;
  tokens: DirectoryTokens;
}) {
  if (loading || categoryCount > 0) return null;
  return (
    <div style={{ fontSize: 12, color: tokens.SUBTLE, padding: "6px 0", marginBottom: 4 }}>
      {allowProposed
        ? "The skills list is unavailable right now — add skills as free text below."
        : "The skills list is unavailable right now. Existing picks are preserved on save."}
    </div>
  );
}

// Keyword search — type to find a skill across every sector without opening accordions. Only shown
// once there is a taxonomy to search.
function SkillKeywordSearch({ categoryCount, search, onSearchChange, tokens }: {
  categoryCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  tokens: DirectoryTokens;
}) {
  if (categoryCount === 0) return null;
  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: tokens.FAINT, pointerEvents: "none" }} />
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search skills by keyword"
        placeholder="Search skills by keyword…"
        style={{ width: "100%", padding: "9px 32px 9px 34px", background: tokens.INPUT_BG, border: `1px solid ${tokens.BORDER_HI}`, borderRadius: 8, fontSize: 13, color: tokens.TEXT, outline: "none", boxSizing: "border-box" }}
      />
      {search && (
        <button type="button" aria-label="Clear skill search" onClick={() => onSearchChange("")}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: tokens.FAINT, cursor: "pointer", padding: 4, lineHeight: 1, display: "flex" }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// While searching, a flat cross-sector result list replaces the accordion. Rendered only when there
// is a taxonomy and a live query.
function SkillSearchResults({ categoryCount, query, search, allEntries, selectedIds, allowProposed, tokens, onToggleEntry }: {
  categoryCount: number;
  query: string;
  search: string;
  allEntries: SkillEntry[];
  selectedIds: Set<string>;
  allowProposed: boolean;
  tokens: DirectoryTokens;
  onToggleEntry: (entry: SkillEntry) => void;
}) {
  if (categoryCount === 0 || query.length === 0) return null;
  const matches = allEntries.filter((e) => e.name.toLowerCase().includes(query));
  return (
    <div style={{ border: `1px solid ${tokens.BORDER_HI}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
      {matches.length === 0 ? (
        <div style={{ fontSize: 12, color: tokens.MUTED }}>
          No skills match “{search.trim()}”.{allowProposed ? " Add it as a free-text skill below." : ""}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {matches.map((e) => (
            <SkillChip key={e.name} entry={e} active={e.ids.some((id) => selectedIds.has(id))} tokens={tokens} onToggleEntry={onToggleEntry} />
          ))}
        </div>
      )}
    </div>
  );
}

// Sector accordion — one sector open at a time, each showing only its own skills. Hidden while a
// keyword search is active (the flat result list takes its place).
function SkillSectorAccordion({ categoryCount, query, categories, selectedIds, openSector, tokens, onSectorToggle, onToggleEntry }: {
  categoryCount: number;
  query: string;
  categories: SkillCategory[];
  selectedIds: Set<string>;
  openSector: string | null;
  tokens: DirectoryTokens;
  onSectorToggle: (sector: string) => void;
  onToggleEntry: (entry: SkillEntry) => void;
}) {
  if (categoryCount === 0 || query.length > 0) return null;
  return (
    <div style={{ border: `1px solid ${tokens.BORDER_HI}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      {categories.map(({ sector, entries }) => (
        <SectorRow
          key={sector}
          sector={sector}
          entries={entries}
          selectedIds={selectedIds}
          isOpen={openSector === sector}
          tokens={tokens}
          onToggle={() => onSectorToggle(sector)}
          onToggleEntry={onToggleEntry}
        />
      ))}
    </div>
  );
}

// Free-text fallback for a skill the taxonomy does not have yet (member self-edit only).
function ProposedSkillsField({ allowProposed, proposedInput, proposedFull, tokens, onProposedInputChange, onAddProposed }: {
  allowProposed: boolean;
  proposedInput: string;
  proposedFull: boolean;
  tokens: DirectoryTokens;
  onProposedInputChange?: (value: string) => void;
  onAddProposed?: () => void;
}) {
  if (!allowProposed) return null;
  // Hoisted once: the Add control is disabled when the list is full or the input is empty.
  const addDisabled = proposedFull || proposedInput.trim().length === 0;
  return (
    <>
      <label htmlFor="dpe-proposed" style={{ fontSize: 11, color: tokens.SUBTLE, display: "block", marginBottom: 6 }}>
        Don&apos;t see what you need? Add it (each ≤ {DIRECTORY_MAX_PROPOSED_SKILL_LENGTH} chars)
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id="dpe-proposed"
          value={proposedInput}
          onChange={(e) => onProposedInputChange?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddProposed?.(); } }}
          maxLength={DIRECTORY_MAX_PROPOSED_SKILL_LENGTH}
          disabled={proposedFull}
          aria-label="Add a skill that is not in the list"
          placeholder="e.g. Game design, Kintsugi…"
          style={{ flex: 1, padding: "9px 12px", background: tokens.INPUT_BG, border: `1px solid ${tokens.BORDER_HI}`, borderRadius: 8, fontSize: 13, color: tokens.TEXT, outline: "none", opacity: proposedFull ? 0.6 : 1, boxSizing: "border-box" }}
        />
        <button
          type="button"
          onClick={onAddProposed}
          disabled={addDisabled}
          style={{
            padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#FBBF24",
            cursor: addDisabled ? "not-allowed" : "pointer",
            opacity: addDisabled ? 0.5 : 1,
          }}
        >
          Add
        </button>
      </div>
      <div style={{ fontSize: 11, color: tokens.FAINT, marginTop: 6, lineHeight: 1.5 }}>
        {proposedFull
          ? `That's the most you can add (${DIRECTORY_MAX_PROPOSED_SKILLS}). Remove one to add another.`
          : "Yellow chips = pending review — they show on your profile until an admin adds them to the official list."}
      </div>
    </>
  );
}

// The Directory profile's skill picker. Selected chips, a keyword search, a one-open-at-a-time sector
// accordion, and a free-text fallback. Unlike the SkillsHunt Scout picker there is no "add a
// profession's skills" prefill — a member authors their own profile, so the third-party "know their
// profession" framing does not apply here (owner decision). There is no hard cap on taxonomy skills
// (Directory enforces none server-side); only the free-text proposed skills are capped.
export function DirectorySkillsPicker(props: DirectorySkillsPickerProps) {
  const {
    tokens, sectors, jobTitles, skills, loading, selectedSkillIds,
    onToggleSkill, onProposedInputChange, onAddProposed, onRemoveProposed,
  } = props;
  const proposedSkills = props.proposedSkills ?? [];
  const proposedInput = props.proposedInput ?? "";
  const allowProposed = Boolean(onProposedInputChange && onAddProposed && onRemoveProposed);

  const [openSector, setOpenSector] = useState<string | null>(null);
  const { categories } = useGroupedTaxonomy(sectors, jobTitles, skills);
  const skillNameById = useMemo(() => new Map(skills.map((s) => [s.id, s.name] as const)), [skills]);
  const selectedIds = useMemo(() => new Set(selectedSkillIds), [selectedSkillIds]);
  const proposedFull = proposedSkills.length >= DIRECTORY_MAX_PROPOSED_SKILLS;

  // Toggle a whole name-entry: unpick removes every selected id that shares the name (both parents'
  // onToggleSkill is a functional setState, so N synchronous calls compose correctly); pick adds the
  // first id as the representative. This is what lets the member treat a repeated name as one skill.
  function toggleEntry(entry: SkillEntry) {
    const selectedForName = entry.ids.filter((id) => selectedIds.has(id));
    if (selectedForName.length > 0) {
      selectedForName.forEach((id) => onToggleSkill(id));
    } else if (entry.ids.length > 0) {
      onToggleSkill(entry.ids[0]);
    }
  }

  // One-open-at-a-time: toggling the currently-open sector closes it, otherwise opens the new one.
  function handleSectorToggle(sector: string) {
    setOpenSector(openSector === sector ? null : sector);
  }

  // Keyword search across every sector — a flat, name-de-duplicated skill list filtered by substring.
  // Local UI state only; it does not touch the form model. While a query is present the accordion is
  // replaced by this flat result list (mirrors the SkillsHunt picker).
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const allEntries = useMemo(() => {
    const byName = new Map<string, string[]>();
    const order: string[] = [];
    for (const s of skills) {
      const ids = byName.get(s.name);
      if (ids) {
        if (!ids.includes(s.id)) ids.push(s.id);
      } else {
        byName.set(s.name, [s.id]);
        order.push(s.name);
      }
    }
    return order
      .map((name) => ({ name, ids: byName.get(name) ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);

  // The selected picks, de-duplicated by name: a profile that already holds two ids for one name
  // shows a single chip, and removing it clears every id behind that name.
  const selectedNames = useMemo(() => {
    const order: string[] = [];
    const idsByName = new Map<string, string[]>();
    for (const id of selectedSkillIds) {
      const name = skillNameById.get(id) ?? "Skill";
      const list = idsByName.get(name);
      if (list) {
        list.push(id);
      } else {
        idsByName.set(name, [id]);
        order.push(name);
      }
    }
    return order.map((name) => ({ name, ids: idsByName.get(name) ?? [] }));
  }, [selectedSkillIds, skillNameById]);

  const labelStyle = { fontSize: 12, fontWeight: 700, color: tokens.MUTED, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6, display: "block" };

  return (
    <div>
      <label style={labelStyle}>
        Specializations
        <SelectedCountBadge count={selectedNames.length} tokens={tokens} />
      </label>

      {/* Selected picks — taxonomy skills in the app accent, proposed skills in amber, each removable. */}
      <SelectedSkillChips
        selectedNames={selectedNames}
        proposedSkills={proposedSkills}
        tokens={tokens}
        onToggleSkill={onToggleSkill}
        onRemoveProposed={onRemoveProposed}
      />

      <LoadingNotice loading={loading} tokens={tokens} />

      <SkillsUnavailableNotice
        loading={loading}
        categoryCount={categories.length}
        allowProposed={allowProposed}
        tokens={tokens}
      />

      {/* Keyword search — type to find a skill across every sector without opening accordions. */}
      <SkillKeywordSearch
        categoryCount={categories.length}
        search={search}
        onSearchChange={setSearch}
        tokens={tokens}
      />

      {/* While searching, a flat cross-sector result list replaces the accordion. */}
      <SkillSearchResults
        categoryCount={categories.length}
        query={query}
        search={search}
        allEntries={allEntries}
        selectedIds={selectedIds}
        allowProposed={allowProposed}
        tokens={tokens}
        onToggleEntry={toggleEntry}
      />

      {/* Sector accordion — one sector open at a time, each showing only its own skills. Hidden
          while a keyword search is active (the flat result list above takes its place). */}
      <SkillSectorAccordion
        categoryCount={categories.length}
        query={query}
        categories={categories}
        selectedIds={selectedIds}
        openSector={openSector}
        tokens={tokens}
        onSectorToggle={handleSectorToggle}
        onToggleEntry={toggleEntry}
      />

      {/* Free-text fallback for a skill the taxonomy does not have yet (member self-edit only). */}
      <ProposedSkillsField
        allowProposed={allowProposed}
        proposedInput={proposedInput}
        proposedFull={proposedFull}
        tokens={tokens}
        onProposedInputChange={onProposedInputChange}
        onAddProposed={onAddProposed}
      />
    </div>
  );
}
