import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import {
  fetchAdminOverview,
  updateAdminConfig,
  type WorkforceConfig,
  type WorkforceDashboard,
} from './admin-api';

const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';

type ConfigForm = {
  population: string;
  participationRate: string;
  minRecruitable: string;
  maxRecruitable: string;
};

function toForm(config: WorkforceConfig): ConfigForm {
  return {
    population: String(config.population),
    participationRate: String(config.participationRate),
    minRecruitable: String(config.minRecruitable),
    maxRecruitable: String(config.maxRecruitable),
  };
}

export const AdminWorkforce = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('workforce', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [form, setForm] = useState<ConfigForm | null>(null);
  const [dashboard, setDashboard] = useState<WorkforceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const result = await fetchAdminOverview();
    if (!result.ok) {
      setForbidden(result.forbidden);
      if (!result.forbidden && result.message) setError(result.message);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setForm(result.config ? toForm(result.config) : null);
    setDashboard(result.dashboard);
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const save = useCallback(async () => {
    if (!auth?.userId || !form) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await updateAdminConfig({
        population: Number(form.population),
        participationRate: Number(form.participationRate),
        minRecruitable: Number(form.minRecruitable),
        maxRecruitable: Number(form.maxRecruitable),
      });
      setForm(toForm(saved));
      setNotice('Config saved.');
    } catch {
      setError('Could not save the config. Check the values and try again.');
    } finally {
      setBusy(false);
    }
  }, [auth, form]);

  if (authLoading || (loading && !forbidden && error === null)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={styles.center}>
        <Text style={styles.noticeText}>The Workforce admin tools are available to admins only.</Text>
      </View>
    );
  }

  const summary: Array<{ label: string; value: number; color: string }> = dashboard
    ? [
        { label: 'Workforce total', value: dashboard.workforceTotal, color: accent },
        { label: 'Headcount target', value: dashboard.totalHeadcountTarget, color: '#EF4444' },
        { label: 'Recruited', value: dashboard.recruitedTotal, color: '#22C55E' },
        { label: 'Directory members', value: dashboard.totalMembers, color: '#A78BFA' },
      ]
    : [];

  const fields: Array<{ key: keyof ConfigForm; label: string; hint?: string }> = [
    { key: 'population', label: 'Population', hint: 'Survivor population baseline' },
    { key: 'participationRate', label: 'Participation rate', hint: '0–1 (e.g. 0.5)' },
    { key: 'minRecruitable', label: 'Min recruitable' },
    { key: 'maxRecruitable', label: 'Max recruitable' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workforce Admin</Text>
      <Text style={styles.subtitle}>Population model. Demand = population × participation rate.</Text>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

      {summary.length > 0 ? (
        <View style={styles.statGrid}>
          {summary.map((item) => (
            <React.Fragment key={item.label}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={[styles.statValue, { color: item.color }]}>{item.value.toLocaleString()}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {form ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Config</Text>
          {fields.map((f) => (
            <View key={f.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={form[f.key]}
                editable={!busy}
                onChangeText={(v) => setForm((c) => (c ? { ...c, [f.key]: v } : c))}
                placeholderTextColor={tokens.textSecondary}
              />
              {f.hint ? <Text style={styles.fieldHint}>{f.hint}</Text> : null}
            </View>
          ))}
          <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={() => void save()} disabled={busy}>
            <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save config'}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 16 },
    center: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
    title: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
    subtitle: { fontSize: 13, color: t.textSecondary, lineHeight: 19 },
    noticeText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' },
    errorBanner: {
      fontSize: 13,
      color: '#FCA5A5',
      backgroundColor: 'rgba(239,68,68,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.3)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noticeBanner: {
      fontSize: 13,
      color: '#86EFAC',
      backgroundColor: 'rgba(34,197,94,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(34,197,94,0.3)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: {
      flexGrow: 1,
      flexBasis: '46%',
      backgroundColor: PANEL,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: t.radius,
      padding: 14,
    },
    statLabel: { fontSize: 11, color: t.textSecondary, marginBottom: 4 },
    statValue: { fontSize: 20, fontWeight: '800' },
    card: {
      backgroundColor: PANEL,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 14,
      padding: 16,
      gap: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: t.textPrimary },
    fieldRow: { gap: 6 },
    fieldLabel: { fontSize: 12, color: t.textSecondary, fontWeight: '600' },
    fieldHint: { fontSize: 11, color: t.textSecondary },
    input: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
      color: t.textPrimary,
    },
    button: {
      backgroundColor: accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 4,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontSize: 14, fontWeight: '800', color: '#3a1d05' },
  });
}
