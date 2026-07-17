// Directory member self-edit screen (mobile) — the React Native counterpart of the web
// components/directory/directory-profile-edit.tsx. Binds to GET /api/directory/profile (prefill) and
// PUT /api/directory/profile (full upsert).
//
// CRITICAL: PUT /api/directory/profile is a FULL UPSERT — any omitted string field is reset to
// ''/null by the server. So this form loads every field, lets the member edit it, and always submits
// the COMPLETE set (edited and unchanged alike) so a save can never blank an untouched payment
// address or location. `country` is required server-side and gates Save here too.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePluginAuth } from './usePluginAuth';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import { CountryPicker, StateFieldMobile } from '../../components/LocationPickers';
import { DirectorySkillsPicker, DIRECTORY_MAX_PROPOSED_SKILL_LENGTH, DIRECTORY_MAX_PROPOSED_SKILLS } from './DirectorySkillsPicker';
import type {
  DirectoryJobTitleOption,
  DirectorySector,
  DirectorySkillOption,
} from './api';
import {
  fetchDirectoryJobTitles,
  fetchDirectorySectors,
  fetchDirectorySkills,
  fetchOwnDirectoryProfile,
  upsertOwnDirectoryProfile,
} from './api';

const BORDER = 'rgba(255,255,255,0.08)';

// The form's working copy — strings for the controlled inputs; converted to the null/string[] shape
// the upsert expects on submit.
type FormState = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  profileUrl: string;
  sectorId: string;
  jobTitleId: string;
  skillIds: string[];
  proposedSkills: string[];
  venmoAddress: string;
  moneroAddress: string;
  bitcoinAddress: string;
  serviceCreditsAddress: string;
  city: string;
  state: string;
  country: string;
};

function emptyForm(): FormState {
  return {
    firstName: '',
    lastName: '',
    headline: '',
    bio: '',
    profileUrl: '',
    sectorId: '',
    jobTitleId: '',
    skillIds: [],
    proposedSkills: [],
    venmoAddress: '',
    moneroAddress: '',
    bitcoinAddress: '',
    serviceCreditsAddress: '',
    city: '',
    state: '',
    country: '',
  };
}

// Trim a free-text field; an empty string becomes null so the server stores NULL rather than ''.
function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type LoadState = 'loading' | 'ready' | 'error';

const TEXT_FIELDS: { label: string; key: 'firstName' | 'lastName' | 'headline' | 'profileUrl'; placeholder: string; required?: boolean }[] = [
  { label: 'First name', key: 'firstName', placeholder: 'First name', required: true },
  { label: 'Last name', key: 'lastName', placeholder: 'Last name' },
  { label: 'Headline', key: 'headline', placeholder: 'A short line about what you do' },
  { label: 'Quora profile URL', key: 'profileUrl', placeholder: 'https://www.quora.com/profile/…' },
];

const PAYMENT_FIELDS: { label: string; key: 'venmoAddress' | 'moneroAddress' | 'bitcoinAddress' | 'serviceCreditsAddress'; placeholder: string }[] = [
  { label: 'Venmo', key: 'venmoAddress', placeholder: '@your-venmo' },
  { label: 'Monero', key: 'moneroAddress', placeholder: 'Monero address' },
  { label: 'Bitcoin', key: 'bitcoinAddress', placeholder: 'Bitcoin address' },
  { label: 'ServiceCredits', key: 'serviceCreditsAddress', placeholder: 'ServiceCredits address' },
];

export function DirectoryProfileEdit({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { auth, loading: authLoading } = usePluginAuth('clerk');
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('directory', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [sectors, setSectors] = useState<DirectorySector[]>([]);
  const [jobTitles, setJobTitles] = useState<DirectoryJobTitleOption[]>([]);
  const [skills, setSkills] = useState<DirectorySkillOption[]>([]);
  const [hadProfile, setHadProfile] = useState(false);
  const [proposedInput, setProposedInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated) {
      setLoadState('error');
      return;
    }
    setLoadState('loading');
    try {
      // Own profile plus the full taxonomy option lists in one shot. Sectors/job-titles/skills load
      // unfiltered so the picker can group every skill by sector and existing picks resolve to names.
      const [profile, sectorData, jobTitleData, skillData] = await Promise.all([
        fetchOwnDirectoryProfile(),
        fetchDirectorySectors(),
        fetchDirectoryJobTitles(),
        fetchDirectorySkills(),
      ]);
      setSectors(sectorData);
      setJobTitles(jobTitleData);
      setSkills(skillData);
      setHadProfile(Boolean(profile));
      setForm({
        firstName: profile?.firstName ?? '',
        lastName: profile?.lastName ?? '',
        headline: profile?.headline ?? '',
        bio: profile?.bio ?? '',
        profileUrl: profile?.profileUrl ?? '',
        sectorId: profile?.sectorId ?? '',
        jobTitleId: profile?.jobTitleId ?? '',
        skillIds: (profile?.skills ?? []).map((s) => s.id),
        proposedSkills: profile?.proposedSkills ?? [],
        venmoAddress: profile?.venmoAddress ?? '',
        moneroAddress: profile?.moneroAddress ?? '',
        bitcoinAddress: profile?.bitcoinAddress ?? '',
        serviceCreditsAddress: profile?.serviceCreditsAddress ?? '',
        city: profile?.city ?? '',
        state: profile?.state ?? '',
        country: profile?.country ?? '',
      });
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [auth]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  // Changing sector clears a now-invalid job-title pick. The job-title chips are filtered from the
  // already-loaded full list client-side, so no refetch is needed.
  const handleSectorChange = (nextSectorId: string) => {
    setForm((prev) => ({
      ...prev,
      sectorId: prev.sectorId === nextSectorId ? '' : nextSectorId,
      jobTitleId: '',
    }));
  };

  const toggleSkill = (id: string) => {
    setForm((prev) => ({
      ...prev,
      skillIds: prev.skillIds.includes(id) ? prev.skillIds.filter((s) => s !== id) : [...prev.skillIds, id],
    }));
  };

  const addOccupationSkills = (ids: string[]) => {
    setForm((prev) => {
      const merged = [...prev.skillIds];
      for (const id of ids) {
        if (!merged.includes(id)) merged.push(id);
      }
      return { ...prev, skillIds: merged };
    });
  };

  // Commit the "skill not listed" draft as a free-text proposed skill. Skips blanks, anything past the
  // count cap, and labels that duplicate an existing entry or an already-selected taxonomy skill.
  const addProposedSkill = () => {
    const label = proposedInput.trim().replace(/\s+/g, ' ').slice(0, DIRECTORY_MAX_PROPOSED_SKILL_LENGTH);
    if (label.length === 0) return;
    const lower = label.toLowerCase();
    setForm((prev) => {
      if (prev.proposedSkills.length >= DIRECTORY_MAX_PROPOSED_SKILLS) return prev;
      if (prev.proposedSkills.some((s) => s.toLowerCase() === lower)) return prev;
      if (skills.some((s) => prev.skillIds.includes(s.id) && s.name.toLowerCase() === lower)) return prev;
      return { ...prev, proposedSkills: [...prev.proposedSkills, label] };
    });
    setProposedInput('');
  };

  const removeProposedSkill = (label: string) => {
    setForm((prev) => ({ ...prev, proposedSkills: prev.proposedSkills.filter((s) => s !== label) }));
  };

  const sectorJobTitles = jobTitles.filter((j) => j.sectorId === form.sectorId);
  // First name and country are both required (city/state stay optional); country gates Save, matching
  // the server, which rejects a blank country on PUT /api/directory/profile.
  const canSave = form.firstName.trim().length > 0 && form.country.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await upsertOwnDirectoryProfile({
        firstName: form.firstName.trim(),
        lastName: nullableTrim(form.lastName),
        headline: nullableTrim(form.headline),
        bio: nullableTrim(form.bio),
        profileUrl: nullableTrim(form.profileUrl),
        sectorId: form.sectorId.trim().length > 0 ? form.sectorId : null,
        jobTitleId: form.jobTitleId.trim().length > 0 ? form.jobTitleId : null,
        skillIds: form.skillIds,
        proposedSkills: form.proposedSkills,
        venmoAddress: nullableTrim(form.venmoAddress),
        moneroAddress: nullableTrim(form.moneroAddress),
        bitcoinAddress: nullableTrim(form.bitcoinAddress),
        serviceCreditsAddress: nullableTrim(form.serviceCreditsAddress),
        city: nullableTrim(form.city),
        state: nullableTrim(form.state),
        country: nullableTrim(form.country),
      });
      onSaved();
    } catch {
      setSaveError('Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>✏️</Text>
        </View>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{hadProfile ? 'Edit my profile' : 'Create my profile'}</Text>
          <Text style={styles.headerSub}>Your directory listing</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.headerClose} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.headerCloseText}>✕</Text>
        </TouchableOpacity>
      </View>

      {loadState === 'loading' ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>Loading your profile…</Text>
        </View>
      ) : loadState === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load your profile.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {TEXT_FIELDS.map((f) => (
              <React.Fragment key={f.key}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    {f.label}
                    {f.required ? <Text style={{ color: accent }}> (required)</Text> : null}
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form[f.key]}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, [f.key]: text }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={tokens.textMuted}
                    autoCapitalize={f.key === 'profileUrl' ? 'none' : 'sentences'}
                    editable={!saving}
                  />
                </View>
              </React.Fragment>
            ))}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>About</Text>
              <TextInput
                style={[styles.fieldInput, styles.multiline]}
                value={form.bio}
                onChangeText={(text) => setForm((prev) => ({ ...prev, bio: text }))}
                placeholder="Tell members about your work"
                placeholderTextColor={tokens.textMuted}
                multiline
                editable={!saving}
              />
            </View>

            {/* Location — shared Country/State controls so the data stays clean. Country is required. */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Country <Text style={{ color: accent }}>(required)</Text></Text>
              <CountryPicker value={form.country} onChange={(country) => setForm((prev) => ({ ...prev, country }))} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>State / Region</Text>
              <StateFieldMobile country={form.country} value={form.state} onChange={(state) => setForm((prev) => ({ ...prev, state }))} />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.city}
                onChangeText={(text) => setForm((prev) => ({ ...prev, city: text }))}
                placeholder="City"
                placeholderTextColor={tokens.textMuted}
                editable={!saving}
              />
            </View>

            {/* Sector — one chip active at a time; picking one clears a now-invalid job title. */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sector</Text>
              {sectors.length === 0 ? (
                <Text style={styles.mutedNote}>The sector list is unavailable right now.</Text>
              ) : (
                <View style={styles.chipWrap}>
                  {sectors.map((sec) => {
                    const active = form.sectorId === sec.id;
                    return (
                      <TouchableOpacity
                        key={sec.id}
                        style={[styles.selectChip, active && styles.selectChipActive]}
                        onPress={() => handleSectorChange(sec.id)}
                      >
                        <Text style={[styles.selectChipText, active && styles.selectChipTextActive]}>{sec.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Job title — filtered by the selected sector. */}
            {form.sectorId ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Job title</Text>
                {sectorJobTitles.length === 0 ? (
                  <Text style={styles.mutedNote}>No job titles listed for this sector.</Text>
                ) : (
                  <View style={styles.chipWrap}>
                    {sectorJobTitles.map((jt) => {
                      const active = form.jobTitleId === jt.id;
                      return (
                        <TouchableOpacity
                          key={jt.id}
                          style={[styles.selectChip, active && styles.selectChipActive]}
                          onPress={() => setForm((prev) => ({ ...prev, jobTitleId: prev.jobTitleId === jt.id ? '' : jt.id }))}
                        >
                          <Text style={[styles.selectChipText, active && styles.selectChipTextActive]}>{jt.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <DirectorySkillsPicker
                tokens={tokens}
                accent={accent}
                sectors={sectors}
                jobTitles={jobTitles}
                skills={skills}
                loading={false}
                selectedSkillIds={form.skillIds}
                proposedSkills={form.proposedSkills}
                proposedInput={proposedInput}
                onToggleSkill={toggleSkill}
                onAddOccupationSkills={addOccupationSkills}
                onProposedInputChange={setProposedInput}
                onAddProposed={addProposedSkill}
                onRemoveProposed={removeProposedSkill}
              />
            </View>

            <Text style={styles.sectionHeading}>Payment addresses</Text>
            {PAYMENT_FIELDS.map((f) => (
              <React.Fragment key={f.key}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form[f.key]}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, [f.key]: text }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={tokens.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!saving}
                  />
                </View>
              </React.Fragment>
            ))}

            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.saveBtn, !canSave && styles.btnDisabled]} onPress={() => void handleSave()} disabled={!canSave}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : hadProfile ? 'Save changes' : 'Create profile'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
      backgroundColor: '#0D0F14',
    },
    headerIcon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: `${accent}20`,
      borderWidth: 1,
      borderColor: `${accent}35`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    headerIconText: { fontSize: 15 },
    headerTitleWrap: { flex: 1 },
    headerTitle: { fontSize: 15, fontWeight: '700', color: t.textPrimary },
    headerSub: { fontSize: 11, color: t.textSecondary },
    headerClose: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCloseText: { fontSize: 14, color: t.textSecondary },

    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 32 },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    centeredText: { fontSize: 13, color: t.textSecondary, textAlign: 'center' },
    retryBtn: { marginTop: 16, backgroundColor: accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28 },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    fieldGroup: { marginBottom: 16 },
    fieldLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 6,
    },
    fieldInput: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 9,
      fontSize: 13,
      color: t.textPrimary,
    },
    multiline: { minHeight: 84, textAlignVertical: 'top' },
    mutedNote: { fontSize: 12, color: t.textSecondary },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    selectChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    selectChipActive: { backgroundColor: `${accent}20`, borderColor: `${accent}50` },
    selectChipText: { fontSize: 12, color: t.textSecondary, fontWeight: '600' },
    selectChipTextActive: { color: accent },

    sectionHeading: {
      fontSize: 12,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginTop: 4,
      marginBottom: 14,
    },

    errorText: { fontSize: 13, color: t.danger, textAlign: 'center', marginTop: 4 },

    footer: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: BORDER,
    },
    saveBtn: {
      flex: 1,
      backgroundColor: accent,
      borderRadius: 11,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    cancelBtn: {
      paddingHorizontal: 16,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: { color: t.textSecondary, fontSize: 14 },
    btnDisabled: { opacity: 0.5 },
  });
}
