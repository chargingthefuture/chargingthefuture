import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SkillsHuntApi, type Round } from './SkillsHuntApi';

const COLOR = '#FBBF24';
const BIO_MAX = 280;

// Taxonomy from the design spec (§2.1); sourced from skills_taxonomy_skills.
// Loaded statically here because there is no unauthenticated taxonomy API
// endpoint exposed to mobile. A future improvement would be fetching from
// GET /api/skills-taxonomy/hierarchy when auth allows.
const SKILL_TAXONOMY: Record<string, string[]> = {
  'Technology':         ['Software Engineering', 'UI/UX Design', 'Data Analysis', 'Web Development', 'IT Support'],
  'Healthcare':         ['Nursing', 'Counseling', 'Mental Health', 'Physical Therapy', 'Home Health Aide'],
  'Trades':             ['Carpentry', 'Plumbing', 'Electrical', 'Welding', 'Auto Repair', 'Masonry'],
  'Creative':           ['Graphic Design', 'Photography', 'Video Editing', 'Writing & Editing'],
  'Education':          ['Teaching', 'Tutoring', 'Translation'],
  'Business & Legal':   ['Accounting', 'Legal Aid', 'Paralegal', 'Marketing'],
  'Food & Hospitality': ['Cooking', 'Catering', 'Barista'],
  'Agriculture':        ['Farming', 'Landscaping', 'Animal Care'],
  'Beauty & Wellness':  ['Hair Styling', 'Cosmetology', 'Massage Therapy'],
};

// ─── Submitted confirmation view ─────────────────────────────────────────────

function SubmittedView({ onReset }: { onReset: () => void }) {
  return (
    <View style={styles.submittedContainer}>
      <View style={styles.submittedIcon}>
        <Text style={{ fontSize: 28, color: '#22C55E' }}>✓</Text>
      </View>
      <Text style={styles.submittedTitle}>Nomination submitted!</Text>
      <Text style={styles.submittedBody}>
        Thank you. Points are granted when an admin accepts.{' '}
        <Text style={{ color: COLOR, fontWeight: '700' }}>+30 pts pending ⏳</Text>
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={onReset}>
        <Text style={styles.primaryBtnText}>Nominate Another</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Taxonomy accordion ──────────────────────────────────────────────────────

function TaxonomyAccordion({
  selected,
  canAddMore,
  onToggle,
}: {
  selected: string[];
  canAddMore: boolean;
  onToggle: (_skill: string) => void;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <View style={styles.accordionRoot}>
      {Object.entries(SKILL_TAXONOMY).map(([cat, catSkills]) => {
        const isOpen = openCategory === cat;
        const selectedInCat = catSkills.filter(s => selected.includes(s)).length;
        return (
          <React.Fragment key={cat}>
            <View>
              <TouchableOpacity
                style={[styles.accordionHeader, isOpen && { backgroundColor: COLOR + '10' }]}
                onPress={() => setOpenCategory(isOpen ? null : cat)}
              >
                <Text style={[styles.accordionLabel, isOpen && { color: COLOR }]}>{cat}</Text>
                <View style={styles.accordionRight}>
                  {selectedInCat > 0 && (
                    <View style={styles.accordionBadge}>
                      <Text style={styles.accordionBadgeText}>{selectedInCat}</Text>
                    </View>
                  )}
                  <Text style={{ color: isOpen ? COLOR : '#6B7280', fontSize: 11 }}>
                    {isOpen ? '▲' : '▼'}
                  </Text>
                </View>
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.accordionBody}>
                  {catSkills.map(skill => {
                    const isSelected = selected.includes(skill);
                    const disabled = !canAddMore && !isSelected;
                    return (
                      <TouchableOpacity
                        key={skill}
                        disabled={disabled}
                        onPress={() => onToggle(skill)}
                        style={[
                          styles.skillBtn,
                          isSelected && { backgroundColor: COLOR + '25', borderColor: COLOR + '60' },
                          disabled && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={[styles.skillBtnText, isSelected && { color: COLOR, fontWeight: '700' }]}>
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
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [quora, setQuora] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [proposed, setProposed] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const allSkillCount = skills.length + proposed.length;
  const canAddMore = allSkillCount < 10;

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

  if (submitted) return <SubmittedView onReset={onReset} />;

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
        Full Name <Text style={{ color: COLOR }}>*</Text>
        <Text style={styles.fieldHint}> · letters &amp; spaces, 2–100 chars</Text>
      </Text>
      <TextInput
        value={fullName}
        onChangeText={t => setFullName(t.replace(/[^a-zA-Z\s]/g, '').slice(0, 100))}
        placeholder="e.g. Amara Williams"
        placeholderTextColor="#6B7280"
        style={[styles.input, fullName.length >= 2 && { borderColor: COLOR + '50' }]}
      />

      {/* Bio */}
      <Text style={styles.fieldLabel}>
        Bio <Text style={styles.fieldHint}>(optional)</Text>
      </Text>
      <TextInput
        value={bio}
        onChangeText={t => setBio(t.slice(0, BIO_MAX))}
        placeholder="One sentence about who they are…"
        placeholderTextColor="#6B7280"
        style={[styles.input, { minHeight: 64 }, bio && { borderColor: COLOR + '50' }]}
        multiline
      />
      <Text style={[styles.tiny, { textAlign: 'right', color: bio.length > 240 ? '#F59E0B' : '#4B5563', marginTop: 2 }]}>
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
        placeholderTextColor="#6B7280"
        style={[styles.input, quora && { borderColor: COLOR + '50' }]}
      />

      {/* Skills */}
      <Text style={styles.fieldLabel}>
        Skills <Text style={{ color: COLOR }}>*</Text>
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
      {canAddMore && (
        <TaxonomyAccordion
          selected={skills}
          canAddMore={canAddMore}
          onToggle={toggleSkill}
        />
      )}

      {/* Free-text fallback */}
      {canAddMore && (
        <View style={styles.freeTextBlock}>
          <Text style={[styles.tiny, { color: '#4B5563', marginBottom: 5 }]}>
            Not in the list? Add free-text skills (comma-separated, each ≤ 40 chars):
          </Text>
          <View style={styles.freeTextRow}>
            <TextInput
              value={freeText}
              onChangeText={setFreeText}
              placeholder="e.g. Kintsugi, Beekeeping…"
              placeholderTextColor="#4B5563"
              style={styles.freeTextInput}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addProposed}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.tiny, { color: '#4B5563', marginTop: 3 }]}>
            Yellow = proposed · admin promotes to taxonomy later
          </Text>
        </View>
      )}
      <Text style={[styles.tiny, { color: '#4B5563', marginTop: 5, marginBottom: 12 }]}>
        {allSkillCount}/10 skills
      </Text>

      {/* Submit button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
      >
        <Text style={[styles.submitBtnText, !canSubmit && { color: '#4B5563' }]}>
          {submitting ? 'Submitting…' : '📤  Submit · points on acceptance'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  muted: { color: '#6B7280', fontSize: 12 },
  errorText: { color: '#EF4444', fontSize: 13, marginBottom: 8 },
  tiny: { fontSize: 10 },

  // Submitted state
  submittedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
    backgroundColor: '#0F1117',
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
  submittedTitle: { fontSize: 18, fontWeight: '800', color: '#F9FAFB', textAlign: 'center' },
  submittedBody: { fontSize: 13, color: '#6B7280', lineHeight: 20, textAlign: 'center', maxWidth: 280 },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: COLOR,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Scout form
  scoutTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB', marginBottom: 4 },
  fieldLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  fieldHint: { color: '#4B5563', fontWeight: '400' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    color: '#E8EAF0',
    fontSize: 14,
  },

  // Chip row
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  chipSelected: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: COLOR + '20',
    borderWidth: 1,
    borderColor: COLOR + '40',
  },
  chipSelectedText: { fontSize: 12, color: COLOR, fontWeight: '600' },
  chipProposed: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  chipProposedText: { fontSize: 12, color: '#FBBF24' },

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
  accordionLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accordionBadge: {
    backgroundColor: COLOR + '25',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  accordionBadgeText: { fontSize: 10, color: COLOR },
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
  skillBtnText: { fontSize: 11, color: '#9CA3AF' },

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
    color: '#E8EAF0',
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
  addBtnText: { color: '#FBBF24', fontSize: 12 },

  // Submit
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLOR,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
