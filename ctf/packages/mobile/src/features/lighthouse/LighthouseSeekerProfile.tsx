import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import { fetchProfile, upsertSeekerProfile } from './api';
import type { LighthouseProfile } from './types';

// Seeker self-service setup (mobile). Mirrors the web
// ctf/packages/web/components/lighthouse/lighthouse-seeker-profile.tsx: a member fills in their
// housing needs here so they can request a stay on a listing. A member can be both a host and a
// seeker (owner decision) — a member who has listed a place can also fill in these details and
// request stays. Saving keeps their host flag intact and does not relabel their account, so this
// screen always shows the editable form.

const SURFACE = 'rgba(255,255,255,0.02)';

type SeekerForm = {
  housingNeeds: string;
  desiredCountry: string;
  desiredMoveInDateIso: string;
  budgetMin: string;
  budgetMax: string;
  bio: string;
  phoneNumber: string;
  signalUrl: string;
  isActive: boolean;
};

const EMPTY_FORM: SeekerForm = {
  housingNeeds: '',
  desiredCountry: '',
  desiredMoveInDateIso: '',
  budgetMin: '',
  budgetMax: '',
  bio: '',
  phoneNumber: '',
  signalUrl: '',
  isActive: true,
};

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = /^\d{4}-\d{2}-\d{2}/.exec(iso);
  return match ? match[0] : '';
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (_value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, placeholder, keyboardType, multiline }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textarea]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.textMuted}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        autoCapitalize="sentences"
      />
    </View>
  );
};

export const LighthouseSeekerProfile: React.FC = () => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SeekerForm>(EMPTY_FORM);
  const [existingType, setExistingType] = useState<'seeker' | 'host' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchProfile()
      .then((profile: LighthouseProfile | null) => {
        if (!mounted || !profile) return;
        setExistingType(profile.profileType === 'host' ? 'host' : 'seeker');
        setForm({
          housingNeeds: profile.housingNeeds ?? '',
          desiredCountry: profile.desiredCountry ?? '',
          desiredMoveInDateIso: dateInputValue(profile.desiredMoveInDateIso),
          budgetMin: typeof profile.budgetMin === 'number' ? String(profile.budgetMin) : '',
          budgetMax: typeof profile.budgetMax === 'number' ? String(profile.budgetMax) : '',
          bio: profile.bio ?? '',
          phoneNumber: profile.phoneNumber ?? '',
          signalUrl: profile.signalUrl ?? '',
          isActive: profile.isActive ?? true,
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setField = (key: Exclude<keyof SeekerForm, 'isActive'>, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSubmit = async () => {
    const budgetMin = toNumberOrNull(form.budgetMin);
    const budgetMax = toNumberOrNull(form.budgetMax);
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      setError('The most you can pay can’t be less than the least you can pay.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const result = await upsertSeekerProfile({
      profileType: 'seeker',
      housingNeeds: form.housingNeeds.trim() || null,
      desiredCountry: form.desiredCountry.trim() || null,
      desiredMoveInDateIso: form.desiredMoveInDateIso.trim() || null,
      budgetMin,
      budgetMax,
      bio: form.bio.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
      signalUrl: form.signalUrl.trim() || null,
      isActive: form.isActive,
    });
    setSubmitting(false);
    if (result.ok) {
      setExistingType('seeker');
      setSaved(true);
      return;
    }
    setError(result.message ?? 'Could not save your details. Please try again.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerTitle}>Your housing details</Text>
      <Text style={styles.headerHint}>
        Tell hosts what you’re looking for. You need these details saved before you can request a stay
        on a listing. A host sees them only after you request their place.
      </Text>

      <View style={styles.card}>
        <Field
          label="What you’re looking for"
          value={form.housingNeeds}
          onChange={(v) => setField('housingNeeds', v)}
          placeholder="Number of people, timing, accessibility, pets, anything a host should know…"
          multiline
        />
        <Field label="Country you want to move to" value={form.desiredCountry} onChange={(v) => setField('desiredCountry', v)} />
        <Field
          label="Ideal move-in date"
          value={form.desiredMoveInDateIso}
          onChange={(v) => setField('desiredMoveInDateIso', v)}
          placeholder="YYYY-MM-DD"
        />
        <Field label="Least you can pay / month" value={form.budgetMin} onChange={(v) => setField('budgetMin', v)} placeholder="0" keyboardType="numeric" />
        <Field label="Most you can pay / month" value={form.budgetMax} onChange={(v) => setField('budgetMax', v)} placeholder="0" keyboardType="numeric" />
        <Field label="About you (optional)" value={form.bio} onChange={(v) => setField('bio', v)} placeholder="A short introduction a host will read." multiline />
        <Field label="Phone (optional)" value={form.phoneNumber} onChange={(v) => setField('phoneNumber', v)} />
        <Field label="Signal link (optional)" value={form.signalUrl} onChange={(v) => setField('signalUrl', v)} placeholder="https://signal.me/#p/…" />

        <TouchableOpacity
          style={[styles.toggle, form.isActive && styles.toggleOn]}
          onPress={() => { setForm((prev) => ({ ...prev, isActive: !prev.isActive })); setSaved(false); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, form.isActive && styles.toggleTextOn]}>
            {form.isActive ? '✓ ' : ''}I’m actively looking for housing
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {saved ? (
          <View style={styles.savedRow}>
            <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
            <Text style={styles.savedText}>Saved. You can now request a stay on any listing.</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Saving…' : existingType === 'seeker' ? 'Save changes' : 'Save your details'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  const MUTED = t.textSecondary;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.bg,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: t.textPrimary,
      marginBottom: 4,
    },
    headerHint: {
      fontSize: 13,
      color: MUTED,
      lineHeight: 19,
      marginBottom: 12,
    },
    card: {
      backgroundColor: SURFACE,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${accent}20`,
      padding: 16,
    },
    field: {
      marginBottom: 12,
    },
    label: {
      fontSize: 12,
      color: MUTED,
      fontWeight: '600',
      marginBottom: 4,
    },
    input: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: 8,
      paddingVertical: 9,
      paddingHorizontal: 10,
      fontSize: 13,
      color: t.textPrimary,
    },
    textarea: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    toggle: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignSelf: 'flex-start',
    },
    toggleOn: {
      backgroundColor: `${accent}14`,
      borderColor: `${accent}40`,
    },
    toggleText: {
      fontSize: 13,
      color: t.textPrimary,
      fontWeight: '600',
    },
    toggleTextOn: {
      color: accent,
    },
    errorText: {
      color: t.danger,
      fontSize: 13,
      marginTop: 10,
    },
    savedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    savedText: {
      color: '#22C55E',
      fontSize: 13,
      flexShrink: 1,
    },
    submitBtn: {
      marginTop: 14,
      backgroundColor: accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#0B0B0F',
    },
  });
}
