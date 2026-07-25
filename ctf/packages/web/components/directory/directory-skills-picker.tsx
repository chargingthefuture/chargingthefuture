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

// Group the ID-based taxonomy by sector for the accordion (the same sector grouping SkillsHunt uses).
// Both the sectors and job-titles maps come from the option lists the edit form already loads, so
// there is no extra fetch; job titles only supply each skill's sector here.
function useGroupedTaxonomy(sectors: TaxonomyOption[], jobTitles: JobTitleOption[], skills: SkillOption[]) {
  return useMemo(() => {
    const sectorNameById = new Map(sectors.map((s) => [s.id, s.name] as const));
    const jobTitleById = new Map(jobTitles.map((j) => [j.id, j] as const));

    const bySector = new Map<string, SkillOption[]>();

    for (const skill of skills) {
      const jobTitle = jobTitleById.get(skill.jobTitleId);
      const sectorName = jobTitle ? sectorNameById.get(jobTitle.sectorId) ?? OTHER_SECTOR : OTHER_SECTOR;

      const sectorSkills = bySector.get(sectorName) ?? [];
      sectorSkills.push(skill);
      bySector.set(sectorName, sectorSkills);
    }

    const categories = [...bySector.entries()]
      .map(([sector, sectorSkills]) => ({
        sector,
        skills: [...sectorSkills].sort((a, b) => a.name.localeCompare(b.name)),
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

// One selectable taxonomy-skill chip — shared by the sector accordion and the keyword-search
// results so both look and behave identically (mirrors the SkillsHunt picker).
function SkillChip({ skill, active, tokens, onToggleSkill }: {
  skill: SkillOption;
  active: boolean;
  tokens: DirectoryTokens;
  onToggleSkill: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggleSkill(skill.id)}
      aria-pressed={active}
      style={{
        padding: "5px 12px", borderRadius: 14, fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
        background: active ? `${tokens.ACCENT}20` : "transparent",
        border: `1px solid ${active ? `${tokens.ACCENT}50` : tokens.BORDER_HI}`,
        color: active ? tokens.ACCENT : tokens.SUBTLE,
      }}
    >
      {active ? "✓ " : ""}{skill.name}
    </button>
  );
}

function SectorRow({
  sector,
  sectorSkills,
  selectedSkillIds,
  isOpen,
  tokens,
  onToggle,
  onToggleSkill,
}: {
  sector: string;
  sectorSkills: SkillOption[];
  selectedSkillIds: string[];
  isOpen: boolean;
  tokens: DirectoryTokens;
  onToggle: () => void;
  onToggleSkill: (id: string) => void;
}) {
  const selectedCount = sectorSkills.filter((s) => selectedSkillIds.includes(s.id)).length;
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
          {sectorSkills.map((s) => (
            <SkillChip key={s.id} skill={s} active={selectedSkillIds.includes(s.id)} tokens={tokens} onToggleSkill={onToggleSkill} />
          ))}
        </div>
      )}
    </div>
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
  const proposedFull = proposedSkills.length >= DIRECTORY_MAX_PROPOSED_SKILLS;

  // Keyword search across every sector — a flat, de-duplicated skill list filtered by substring.
  // Local UI state only; it does not touch the form model. Matches the SkillsHunt picker exactly:
  // while a query is present the accordion is replaced by a flat cross-sector result list.
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const allSkills = useMemo(() => {
    const byId = new Map(skills.map((s) => [s.id, s] as const));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);
  const matches = query ? allSkills.filter((s) => s.name.toLowerCase().includes(query)) : [];

  const labelStyle = { fontSize: 12, fontWeight: 700, color: tokens.MUTED, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6, display: "block" };

  return (
    <div>
      <label style={labelStyle}>
        Specializations
        {selectedSkillIds.length > 0 && (
          <span style={{ marginLeft: 8, color: tokens.ACCENT, fontWeight: 700 }}>{selectedSkillIds.length} selected</span>
        )}
      </label>

      {/* Selected picks — taxonomy skills in the app accent, proposed skills in amber, each removable. */}
      {(selectedSkillIds.length > 0 || proposedSkills.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {selectedSkillIds.map((id) => (
            <span key={id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: `${tokens.ACCENT}20`, border: `1px solid ${tokens.ACCENT}40`, fontSize: 12, color: tokens.ACCENT, fontWeight: 600 }}>
              {skillNameById.get(id) ?? "Skill"}
              <button type="button" aria-label={`Remove ${skillNameById.get(id) ?? "skill"}`} onClick={() => onToggleSkill(id)} style={{ background: "none", border: "none", color: tokens.ACCENT, cursor: "pointer", padding: 0, lineHeight: 1, display: "flex" }}>
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
      )}

      {loading && <div style={{ fontSize: 12, color: tokens.MUTED, padding: "10px 0" }}>Loading skills…</div>}

      {!loading && categories.length === 0 && (
        <div style={{ fontSize: 12, color: tokens.SUBTLE, padding: "6px 0", marginBottom: 4 }}>
          {allowProposed
            ? "The skills list is unavailable right now — add skills as free text below."
            : "The skills list is unavailable right now. Existing picks are preserved on save."}
        </div>
      )}

      {/* Keyword search — type to find a skill across every sector without opening accordions. */}
      {categories.length > 0 && (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: tokens.FAINT, pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search skills by keyword"
            placeholder="Search skills by keyword…"
            style={{ width: "100%", padding: "9px 32px 9px 34px", background: tokens.INPUT_BG, border: `1px solid ${tokens.BORDER_HI}`, borderRadius: 8, fontSize: 13, color: tokens.TEXT, outline: "none", boxSizing: "border-box" }}
          />
          {search && (
            <button type="button" aria-label="Clear skill search" onClick={() => setSearch("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: tokens.FAINT, cursor: "pointer", padding: 4, lineHeight: 1, display: "flex" }}>
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* While searching, a flat cross-sector result list replaces the accordion. */}
      {categories.length > 0 && query && (
        <div style={{ border: `1px solid ${tokens.BORDER_HI}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
          {matches.length === 0 ? (
            <div style={{ fontSize: 12, color: tokens.MUTED }}>
              No skills match “{search.trim()}”.{allowProposed ? " Add it as a free-text skill below." : ""}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {matches.map((s) => (
                <SkillChip key={s.id} skill={s} active={selectedSkillIds.includes(s.id)} tokens={tokens} onToggleSkill={onToggleSkill} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sector accordion — one sector open at a time, each showing only its own skills. Hidden
          while a keyword search is active (the flat result list above takes its place). */}
      {categories.length > 0 && !query && (
        <div style={{ border: `1px solid ${tokens.BORDER_HI}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          {categories.map(({ sector, skills: sectorSkills }) => (
            <SectorRow
              key={sector}
              sector={sector}
              sectorSkills={sectorSkills}
              selectedSkillIds={selectedSkillIds}
              isOpen={openSector === sector}
              tokens={tokens}
              onToggle={() => setOpenSector(openSector === sector ? null : sector)}
              onToggleSkill={onToggleSkill}
            />
          ))}
        </div>
      )}

      {/* Free-text fallback for a skill the taxonomy does not have yet (member self-edit only). */}
      {allowProposed && (
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
              disabled={proposedFull || proposedInput.trim().length === 0}
              style={{
                padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#FBBF24",
                cursor: proposedFull || proposedInput.trim().length === 0 ? "not-allowed" : "pointer",
                opacity: proposedFull || proposedInput.trim().length === 0 ? 0.5 : 1,
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
      )}
    </div>
  );
}
