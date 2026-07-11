import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SkillsHuntApi, type Round, type TaxonomyFlattenedItem } from './SkillsHuntApi';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

const BIO_MAX = 280;

// Group flattened taxonomy rows from GET /api/skills-taxonomy/flattened into the
// picker's category → skills shape: sectorName → de-duped, sorted list of skill names.
// A skill may appear under multiple sectors; selecting the name selects it.
function groupBySector(rows: TaxonomyFlattenedItem[]): Record<string, string[]> {
  const bySector = new Map<string, Set<string>>();
  for (const row of rows) {
    const sector = row.sectorName?.trim();
    const skill = row.skillName?.trim();
    if (!sector || !skill) continue;
    let set = bySector.get(sector);
    if (!set) {
      set = new Set<string>();
      bySector.set(sector, set);
    }
    set.add(skill);
  }
  const result: Record<string, string[]> = {};
  for (const sector of [...bySector.keys()].sort((a, b) => a.localeCompare(b))) {
    const skills = bySector.get(sector);
    if (!skills) continue;
    result[sector] = [...skills].sort((a, b) => a.localeCompare(b));
  }
  return result;
}

type TaxonomyState =
  | { status: 'loading' }
  | { status: 'ready'; categories: Record<string, string[]> }
  | { status: 'error' };

type Styles = ReturnType<typeof makeStyles>;

// ─── Submitted confirmation view ─────────────────────────────────────────────

function SubmittedView({ onReset, s, t, accent }: { onReset: () => void; s: Styles; t: ThemeTokens; accent: string }) {
  return (
    <View style={s.submittedContainer}>
      <View style={s.submittedIcon}>
        <Text style={{ fontSize: 28, color: t.success }}>✓</Text>
      </View>
      <Text style={s.submittedTitle}>Nomination submitted!</Text>
      <Text style={s.submittedBody}>
        Thank you. Points are granted when an admin accepts.{' '}
        <Text style={{ color: accent, fontWeight: '700' }}>+30 pts pending ⏳</Text>
      </Text>
      <TouchableOpacity style={s.primaryBtn} onPress={onReset}>
        <Text style={s.primaryBtnText}>Nominate Another</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Taxonomy accordion ──────────────────────────────────────────────────────

function TaxonomyAccordion({
  categories,
  selected,
  canAddMore,
  onToggle,
  s,
  t,
  accent,
}: {
  categories: Record<string, string[]>;
  selected: string[];
  canAddMore: boolean;
  onToggle: (_skill: string) => void;
  s: Styles;
  t: ThemeTokens;
  accent: string;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <View style={s.accordionRoot}>
      {Object.entries(categories).map(([cat, catSkills]) => {
        const isOpen = openCategory === cat;
        const selectedInCat = catSkills.filter(sk => selected.includes(sk)).length;
        return (
          <React.Fragment key={cat}>
            <View>
              <TouchableOpacity
                style={[s.accordionHeader, isOpen && { backgroundColor: accent + '10' }]}
                onPress={() => setOpenCategory(isOpen ? null : cat)}
              >
                <Text style={[s.accordionLabel, isOpen && { color: accent }]}>{cat}</Text>
                <View style={s.accordionRight}>
                  {selectedInCat > 0 && (
                    <View style={s.accordionBadge}>
                      <Text style={s.accordionBadgeText}>{selectedInCat}</Text>
                    </View>
                  )}
                  <Text style={{ color: isOpen ? accent : t.textSecondary, fontSize: 11 }}>
                    {isOpen ? '▲' : '▼'}
                  </Text>
                </View>
              </TouchableOpacity>
              {isOpen && (
                <View style={s.accordionBody}>
                  {catSkills.map(skill => {
                    const isSelected = selected.includes(skill);
                    const disabled = !canAddMore && !isSelected;
                    return (
                      <TouchableOpacity
                        key={skill}
                        disabled={disabled}
                        onPress={() => onToggle(skill)}
                        style={[
                          s.skillBtn,
                          isSelected && { backgroundColor: accent + '25', borderColor: accent + '60' },
                          disabled && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={[s.skillBtnText, isSelected && { color: accent, fontWeight: '700' }]}>
                          {isSelected ? '✓ ' : ''}{skill}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Scout tab ───────────────────────────────────────────────────────────────

export function SkillsHuntScoutTab({ round }: { round: Round }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('skills-hunt', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [quora, setQuora] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [proposed, setProposed] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [taxonomy, setTaxonomy] = useState<TaxonomyState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await SkillsHuntApi.listTaxonomyFlattened();
        if (!active) return;
        setTaxonomy({ status: 'ready', categories: groupBySector(res.items ?? []) });
      } catch {
        if (active) setTaxonomy({ status: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const allSkillCount = skills.length + proposed.length;
  const canAddMore = allSkillCount < 10;
  const taxonomyCategories = taxonomy.status === 'ready' ? taxonomy.categories : {};
  const hasCategories = Object.keys(taxonomyCategories).length > 0;

  const toggleSkill = (s: string) => {
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const addProposed = () => {
    const tokens = freeText
      .split(/[,\n]+/)
      .map(t => t.trim())
      .filter(t => t && t.length <= 40 && !skills.includes(t) && !proposed.includes(t));
    if (tokens.length && allSkillCount + tokens.length <= 10) {
      setProposed(prev => [...prev, ...tokens]);
    }
    setFreeText('');
  };

  const removeProposed = (s: string) => setProposed(prev => prev.filter(x => x !== s));
  const canSubmit = fullName.trim().length >= 2 && allSkillCount > 0 && !submitting;

  const onReset = () => {
    setSubmitted(false);
    setFullName('');
    setBio('');
    setQuora('');
    setSkills([]);
    setProposed([]);
    setFreeText('');
    setSubmitError(null);
  };

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await SkillsHuntApi.submitNomination(round.id, {
        fullName: fullName.trim(),
        bio: bio.trim(),
        quoraProfileUrl: quora.trim(),
        skills: skills.slice(0, 10),
        proposedSkills: proposed,
        claimedProfessions: [],
      });
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit nomination.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return <SubmittedView onReset={onReset} s={styles} t={tokens} accent={accent} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.scoutTitle}>Nominate a Survivor</Text>
      <Text style={styles.muted}>
        Think of someone you believe may be a survivor — no certainty needed. Their Quora profile
        helps verify their identity, and their skills join our economy.
      </Text>

      {submitError && <Text style={styles.errorText}>{submitError}</Text>}

      {/* Full Name */}
      <Text style={styles.fieldLabel}>
        Full Name <Text style={{ color: accent }}>*</Text>
        <Text style={styles.fieldHint}> · letters &amp; spaces, 2–100 chars</Text>
      </Text>
      <TextInput
        value={fullName}
        onChangeText={t => setFullName(t.replace(/[^a-zA-Z\s]/g, '').slice(0, 100))}
        placeholder="e.g. Amara Williams"
        placeholderTextColor={tokens.textSecondary}
        style={[styles.input, fullName.length >= 2 && { borderColor: accent + '50' }]}
      />

      {/* Bio */}
      <Text style={styles.fieldLabel}>
        Bio <Text style={styles.fieldHint}>(optional)</Text>
      </Text>
      <TextInput
        value={bio}
        onChangeText={t => setBio(t.slice(0, BIO_MAX))}
        placeholder="One sentence about who they are…"
        placeholderTextColor={tokens.textSecondary}
        style={[styles.input, { minHeight: 64 }, bio && { borderColor: accent + '50' }]}
        multiline
      />
      <Text style={[styles.tiny, { textAlign: 'right', color: bio.length > 240 ? '#F59E0B' : tokens.textMuted, marginTop: 2 }]}>
        {bio.length}/{BIO_MAX}
      </Text>

      {/* Quora URL */}
      <Text style={styles.fieldLabel}>
        Quora Profile URL <Text style={styles.fieldHint}>(social proof)</Text>
      </Text>
      <TextInput
        value={quora}
        onChangeText={setQuora}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="quora.com/profile/..."
        placeholderTextColor={tokens.textSecondary}
        style={[styles.input, quora && { borderColor: accent + '50' }]}
      />

      {/* Skills */}
      <Text style={styles.fieldLabel}>
        Skills <Text style={{ color: accent }}>*</Text>
        <Text style={styles.fieldHint}> · pick from taxonomy (max 10)</Text>
      </Text>

      {/* Selected skill chips */}
      {(skills.length > 0 || proposed.length > 0) && (
        <View style={styles.chipRow}>
          {skills.map(s => (
            <TouchableOpacity key={s} style={styles.chipSelected} onPress={() => toggleSkill(s)}>
              <Text style={styles.chipSelectedText}>{s} ✕</Text>
            </TouchableOpacity>
          ))}
          {proposed.map(s => (
            <TouchableOpacity key={s} style={styles.chipProposed} onPress={() => removeProposed(s)}>
              <Text style={styles.chipProposedText}>{s} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Accordion taxonomy picker */}
      {canAddMore && taxonomy.status === 'loading' && (
        <Text style={[styles.tiny, { color: tokens.textSecondary, marginVertical: 8 }]}>Loading skills…</Text>
      )}
      {canAddMore && taxonomy.status === 'error' && (
        <Text style={[styles.tiny, { color: '#F59E0B', marginVertical: 6 }]}>
          Could not load the skills list — add skills as free text below.
        </Text>
      )}
      {canAddMore && taxonomy.status === 'ready' && hasCategories && (
        <TaxonomyAccordion
          categories={taxonomyCategories}
          selected={skills}
          canAddMore={canAddMore}
          onToggle={toggleSkill}
          s={styles}
          t={tokens}
          accent={accent}
        />
      )}

      {/* Free-text fallback */}
      {canAddMore && (
        <View style={styles.freeTextBlock}>
          <Text style={[styles.tiny, { color: tokens.textMuted, marginBottom: 5 }]}>
            Not in the list? Add free-text skills (comma-separated, each ≤ 40 chars):
          </Text>
          <View style={styles.freeTextRow}>
            <TextInput
              value={freeText}
              onChangeText={setFreeText}
              placeholder="e.g. Kintsugi, Beekeeping…"
              placeholderTextColor={tokens.textMuted}
              style={styles.freeTextInput}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addProposed}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.tiny, { color: tokens.textMuted, marginTop: 3 }]}>
            Yellow = proposed · admin promotes to taxonomy later
          </Text>
        </View>
      )}
      <Text style={[styles.tiny, { color: tokens.textMuted, marginTop: 5, marginBottom: 12 }]}>
        {allSkillCount}/10 skills
      </Text>

      {/* Submit button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
      >
        <Text style={[styles.submitBtnText, !canSubmit && { color: tokens.textMuted }]}>
          {submitting ? 'Submitting…' : '📤  Submit · points on acceptance'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    muted: { color: t.textSecondary, fontSize: 12 },
    errorText: { color: t.danger, fontSize: 13, marginBottom: 8 },
    tiny: { fontSize: 10 },

    // Submitted state
    submittedContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 16,
      backgroundColor: t.bg,
    },
    submittedIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#22C55E20',
      borderWidth: 1,
      borderColor: '#22C55E40',
      alignItems: 'center',
      justifyContent: 'center',
    },
    submittedTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, textAlign: 'center' },
    submittedBody: { fontSize: 13, color: t.textSecondary, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
    primaryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: t.radius,
      backgroundColor: accent,
      alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // Scout form
    scoutTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary, marginBottom: 4 },
    fieldLabel: { color: t.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 12, marginBottom: 4 },
    fieldHint: { color: t.textMuted, fontWeight: '400' },
    input: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      color: t.textShell,
      fontSize: 14,
    },

    // Chip row
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
    chipSelected: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: accent + '20',
      borderWidth: 1,
      borderColor: accent + '40',
    },
    chipSelectedText: { fontSize: 12, color: accent, fontWeight: '600' },
    chipProposed: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: 'rgba(251,191,36,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.3)',
    },
    chipProposedText: { fontSize: 12, color: accent },

    // Accordion
    accordionRoot: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 8,
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 9,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    accordionLabel: { color: t.textSecondary, fontSize: 12, fontWeight: '600' },
    accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    accordionBadge: {
      backgroundColor: accent + '25',
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    accordionBadgeText: { fontSize: 10, color: accent },
    accordionBody: {
      padding: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.01)',
    },
    skillBtn: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    skillBtnText: { fontSize: 11, color: t.textSecondary },

    // Free-text
    freeTextBlock: { marginTop: 4 },
    freeTextRow: { flexDirection: 'row', gap: 6 },
    freeTextInput: {
      flex: 1,
      padding: 8,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
      borderRadius: 8,
      fontSize: 12,
      color: t.textShell,
    },
    addBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: 'rgba(251,191,36,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: { color: accent, fontSize: 12 },

    // Submit
    submitBtn: {
      paddingVertical: 14,
      borderRadius: t.radius,
      backgroundColor: accent,
      alignItems: 'center',
    },
    submitBtnDisabled: { backgroundColor: t.borderFaint },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
