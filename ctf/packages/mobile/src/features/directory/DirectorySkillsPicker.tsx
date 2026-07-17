// Directory skills picker (mobile) — the ID-based counterpart of the web
// components/directory/directory-skills-picker.tsx. Mirrors the SkillsHunt Scout picker's RN styling
// (TaxonomyAccordion + SkillChip) so skill picking looks and behaves the same across the app:
// removable selected chips, an optional "add a profession's skills" prefill, a one-open-at-a-time
// sector accordion, and an optional free-text "pending review" fallback.
//
// Unlike SkillsHunt (which is NAME-string based), Directory stores skills as taxonomy IDs. This
// picker toggles skill IDs and resolves names only for display. When the proposed-skill props are
// absent (the admin edit screen), the free-text section is not rendered — the admin update contract
// has no proposedSkills.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ThemeTokens } from '../../theme';
import type { DirectoryJobTitleOption, DirectorySector, DirectorySkillOption } from './api';

// Free-text proposed-skill caps — mirror the web lib/directory/constants values.
export const DIRECTORY_MAX_PROPOSED_SKILL_LENGTH = 40;
export const DIRECTORY_MAX_PROPOSED_SKILLS = 10;

// Skills whose job title is missing/inactive still need a home in the accordion so they stay
// selectable; they go under this bucket, sorted last.
const OTHER_SECTOR = 'Other';

interface DirectorySkillsPickerProps {
  tokens: ThemeTokens;
  accent: string;
  sectors: DirectorySector[];
  jobTitles: DirectoryJobTitleOption[];
  skills: DirectorySkillOption[];
  loading: boolean;
  selectedSkillIds: string[];
  onToggleSkill: (_id: string) => void;
  onAddOccupationSkills: (_ids: string[]) => void;
  // Free-text "pending review" proposals are member-owned: the member self-edit form passes all of
  // these; the admin edit form omits them (its update contract has no proposedSkills), which hides
  // the free-text section entirely.
  proposedSkills?: string[];
  proposedInput?: string;
  onProposedInputChange?: (_value: string) => void;
  onAddProposed?: () => void;
  onRemoveProposed?: (_label: string) => void;
}

type Category = { sector: string; skills: DirectorySkillOption[] };
type Occupation = { name: string; ids: string[] };

// Group the ID-based taxonomy the way the web useGroupedTaxonomy does: by sector for the accordion,
// and by job-title (occupation) for the "add a profession's skills" shortcut. Both come from the one
// set of option lists the edit form already loads, so there is no extra fetch.
function useGroupedTaxonomy(
  sectors: DirectorySector[],
  jobTitles: DirectoryJobTitleOption[],
  skills: DirectorySkillOption[],
): { categories: Category[]; occupations: Occupation[] } {
  return useMemo(() => {
    const sectorNameById = new Map(sectors.map((s) => [s.id, s.name] as const));
    const jobTitleById = new Map(jobTitles.map((j) => [j.id, j] as const));

    const bySector = new Map<string, DirectorySkillOption[]>();
    const byOccupation = new Map<string, string[]>();

    for (const skill of skills) {
      const jobTitle = jobTitleById.get(skill.jobTitleId);
      const sectorName = jobTitle ? sectorNameById.get(jobTitle.sectorId) ?? OTHER_SECTOR : OTHER_SECTOR;

      const sectorSkills = bySector.get(sectorName) ?? [];
      sectorSkills.push(skill);
      bySector.set(sectorName, sectorSkills);

      if (jobTitle) {
        const occupationSkills = byOccupation.get(jobTitle.name) ?? [];
        occupationSkills.push(skill.id);
        byOccupation.set(jobTitle.name, occupationSkills);
      }
    }

    const categories: Category[] = [...bySector.entries()]
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

    const occupations: Occupation[] = [...byOccupation.entries()]
      .map(([name, ids]) => ({ name, ids }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { categories, occupations };
  }, [sectors, jobTitles, skills]);
}

function SectorRow({
  sector,
  sectorSkills,
  selectedSkillIds,
  isOpen,
  s,
  accent,
  tokens,
  onToggle,
  onToggleSkill,
}: {
  sector: string;
  sectorSkills: DirectorySkillOption[];
  selectedSkillIds: string[];
  isOpen: boolean;
  s: ReturnType<typeof makeStyles>;
  accent: string;
  tokens: ThemeTokens;
  onToggle: () => void;
  onToggleSkill: (_id: string) => void;
}) {
  const selectedCount = sectorSkills.filter((sk) => selectedSkillIds.includes(sk.id)).length;
  return (
    <View>
      <TouchableOpacity style={[s.accordionHeader, isOpen && { backgroundColor: accent + '10' }]} onPress={onToggle}>
        <Text style={[s.accordionLabel, isOpen && { color: accent }]}>{sector}</Text>
        <View style={s.accordionRight}>
          {selectedCount > 0 && (
            <View style={s.accordionBadge}>
              <Text style={s.accordionBadgeText}>{selectedCount} selected</Text>
            </View>
          )}
          <Text style={{ color: isOpen ? accent : tokens.textSecondary, fontSize: 11 }}>{isOpen ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {isOpen && (
        <View style={s.accordionBody}>
          {sectorSkills.map((sk) => {
            const active = selectedSkillIds.includes(sk.id);
            return (
              <TouchableOpacity
                key={sk.id}
                onPress={() => onToggleSkill(sk.id)}
                style={[s.skillBtn, active && { backgroundColor: accent + '25', borderColor: accent + '60' }]}
              >
                <Text style={[s.skillBtnText, active && { color: accent, fontWeight: '700' }]}>
                  {active ? '✓ ' : ''}{sk.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function DirectorySkillsPicker(props: DirectorySkillsPickerProps) {
  const {
    tokens, accent, sectors, jobTitles, skills, loading, selectedSkillIds,
    onToggleSkill, onAddOccupationSkills, onProposedInputChange, onAddProposed, onRemoveProposed,
  } = props;
  const proposedSkills = props.proposedSkills ?? [];
  const proposedInput = props.proposedInput ?? '';
  const allowProposed = Boolean(onProposedInputChange && onAddProposed && onRemoveProposed);

  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [openSector, setOpenSector] = useState<string | null>(null);
  const { categories, occupations } = useGroupedTaxonomy(sectors, jobTitles, skills);
  const skillNameById = useMemo(() => new Map(skills.map((sk) => [sk.id, sk.name] as const)), [skills]);
  const proposedFull = proposedSkills.length >= DIRECTORY_MAX_PROPOSED_SKILLS;
  const canAddProposed = allowProposed && !proposedFull && proposedInput.trim().length > 0;

  return (
    <View>
      <Text style={s.label}>
        Specializations
        {selectedSkillIds.length > 0 ? <Text style={{ color: accent, fontWeight: '700' }}>  {selectedSkillIds.length} selected</Text> : null}
      </Text>

      {/* Selected picks — taxonomy skills in the app accent, proposed skills in amber, each removable. */}
      {(selectedSkillIds.length > 0 || proposedSkills.length > 0) && (
        <View style={s.chipRow}>
          {selectedSkillIds.map((id) => (
            <TouchableOpacity key={id} style={s.chipSelected} onPress={() => onToggleSkill(id)}>
              <Text style={s.chipSelectedText}>{skillNameById.get(id) ?? 'Skill'} ✕</Text>
            </TouchableOpacity>
          ))}
          {proposedSkills.map((label) => (
            <TouchableOpacity key={label} style={s.chipProposed} onPress={() => onRemoveProposed?.(label)}>
              <Text style={s.chipProposedText}>{label} ✎ ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Profession shortcut — picking an occupation adds all of its skills at once. */}
      {occupations.length > 0 && (
        <View style={s.occupationBlock}>
          <Text style={s.hint}>Know their profession? Add its skills (optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.occupationRow}
          >
            {occupations.map((occ) => (
              <TouchableOpacity key={occ.name} style={s.occupationChip} onPress={() => onAddOccupationSkills(occ.ids)}>
                <Text style={s.occupationChipText}>+ {occ.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? <Text style={s.stateText}>Loading skills…</Text> : null}

      {!loading && categories.length === 0 ? (
        <Text style={s.stateText}>
          {allowProposed
            ? 'The skills list is unavailable right now — add skills as free text below.'
            : 'The skills list is unavailable right now. Existing picks are preserved on save.'}
        </Text>
      ) : null}

      {/* Sector accordion — one sector open at a time, each showing only its own skills. */}
      {categories.length > 0 && (
        <View style={s.accordionRoot}>
          {categories.map(({ sector, skills: sectorSkills }) => (
            <SectorRow
              key={sector}
              sector={sector}
              sectorSkills={sectorSkills}
              selectedSkillIds={selectedSkillIds}
              isOpen={openSector === sector}
              s={s}
              accent={accent}
              tokens={tokens}
              onToggle={() => setOpenSector(openSector === sector ? null : sector)}
              onToggleSkill={onToggleSkill}
            />
          ))}
        </View>
      )}

      {/* Free-text fallback for a skill the taxonomy does not have yet (member self-edit only). */}
      {allowProposed && (
        <View style={s.freeTextBlock}>
          <Text style={s.hint}>
            Don&apos;t see what you need? Add it (each ≤ {DIRECTORY_MAX_PROPOSED_SKILL_LENGTH} chars)
          </Text>
          <View style={s.freeTextRow}>
            <TextInput
              value={proposedInput}
              onChangeText={(text) => onProposedInputChange?.(text.slice(0, DIRECTORY_MAX_PROPOSED_SKILL_LENGTH))}
              editable={!proposedFull}
              placeholder="e.g. Game design, Kintsugi…"
              placeholderTextColor={tokens.textMuted}
              style={[s.freeTextInput, proposedFull && { opacity: 0.6 }]}
            />
            <TouchableOpacity
              style={[s.addBtn, !canAddProposed && { opacity: 0.5 }]}
              onPress={onAddProposed}
              disabled={!canAddProposed}
            >
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.freeTextNote}>
            {proposedFull
              ? `That's the most you can add (${DIRECTORY_MAX_PROPOSED_SKILLS}). Remove one to add another.`
              : 'Yellow chips = pending review — they show on your profile until an admin adds them to the official list.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const PROPOSED_COLOR = '#FBBF24';

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    label: {
      fontSize: 10,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 8,
    },
    hint: { fontSize: 11, color: t.textSecondary, marginBottom: 6 },
    stateText: { fontSize: 12, color: t.textSecondary, marginVertical: 8 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    chipSelected: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: accent + '20',
      borderWidth: 1,
      borderColor: accent + '40',
    },
    chipSelectedText: { fontSize: 12, color: accent, fontWeight: '600' },
    chipProposed: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: 'rgba(251,191,36,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.3)',
    },
    chipProposedText: { fontSize: 12, color: PROPOSED_COLOR, fontWeight: '600' },

    occupationBlock: { marginBottom: 10 },
    occupationRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
    occupationChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: accent + '30',
    },
    occupationChipText: { fontSize: 12, color: accent, fontWeight: '600' },

    accordionRoot: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 12,
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 10,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    accordionLabel: { color: t.textSecondary, fontSize: 13, fontWeight: '600' },
    accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    accordionBadge: {
      backgroundColor: accent + '25',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 1,
    },
    accordionBadgeText: { fontSize: 10, color: accent, fontWeight: '700' },
    accordionBody: {
      padding: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      backgroundColor: 'rgba(255,255,255,0.01)',
    },
    skillBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    skillBtnText: { fontSize: 13, color: t.textSecondary },

    freeTextBlock: { marginTop: 2 },
    freeTextRow: { flexDirection: 'row', gap: 8 },
    freeTextInput: {
      flex: 1,
      padding: 9,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
      borderRadius: 8,
      fontSize: 13,
      color: t.textShell,
    },
    addBtn: {
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: 'rgba(251,191,36,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: { color: PROPOSED_COLOR, fontSize: 13, fontWeight: '700' },
    freeTextNote: { fontSize: 11, color: t.textMuted, marginTop: 6, lineHeight: 16 },
  });
}
