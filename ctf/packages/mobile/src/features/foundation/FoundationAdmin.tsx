// Foundation Admin, copied from the web FoundationAdminShell (foundation-admin-shell.tsx): the capacity
// policy with the quota state and the five limits, and Save policy. Reached from the Admin pill in the
// Foundation header, which shows to admins only. The web's snapshot counts are read on its server with
// no route the app can call, so they are not here; pull to refresh stands in for the web admin header's
// refresh button.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchCapacityPolicy, saveCapacityPolicy, type CapacityPolicyForm, type QuotaState } from './FoundationDataApi';
import { FDButton } from './FDButton';
import { font, useFDTheme } from './useFDTheme';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { reportError } from '../../observability/report';

type NumericKey = Exclude<keyof CapacityPolicyForm, 'quotaState'>;

const QUOTA_STATES: { value: QuotaState; color: string }[] = [
  { value: 'green', color: '#22C55E' },
  { value: 'yellow', color: '#EAB308' },
  { value: 'orange', color: '#F97316' },
  { value: 'red', color: '#EF4444' },
];

const NUMERIC_FIELDS: { key: NumericKey; label: string }[] = [
  { key: 'maxActiveThreadsPerUser', label: 'Max active threads / user' },
  { key: 'maxMessagesPerMinute', label: 'Max messages / min' },
  { key: 'maxSearchesPerMinute', label: 'Max searches / min' },
  { key: 'maxQuoteTransitionsPerMinute', label: 'Max quote transitions / min' },
  { key: 'maxCallDurationMinutes', label: 'Max call duration (min)' },
];

function usePolicy() {
  const [form, setForm] = useState<CapacityPolicyForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setForm(await fetchCapacityPolicy());
      setLoadError(null);
    } catch (caught) {
      reportError(caught, { area: 'foundation', op: 'admin_capacity_policy_read' });
      setLoadError(caught instanceof Error ? caught.message : 'Capacity policy unavailable.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };
  return { form, loadError, refreshing, refresh };
}

function QuotaButtons({ value, onChange }: { value: QuotaState; onChange: (_v: QuotaState) => void }) {
  const { t, r } = useFDTheme();
  return (
    <View style={styles.quotaRow}>
      {QUOTA_STATES.map((q) => {
        const active = value === q.value;
        return (
          <Pressable
            key={q.value}
            onPress={() => onChange(q.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.quota, { borderRadius: r(8), backgroundColor: active ? `${q.color}22` : 'transparent', borderColor: active ? q.color : t.BORDER_SOLID }]}
          >
            <Text style={[font(13, '600'), styles.capitalize, { color: active ? q.color : t.MUTED }]}>{q.value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PolicyCard({ initial }: { initial: CapacityPolicyForm }) {
  const { t, r } = useFDTheme();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setNumber = (key: NumericKey, raw: string) => setForm((prev) => ({ ...prev, [key]: Math.max(0, Math.floor(Number(raw) || 0)) }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const failure = await saveCapacityPolicy(form);
      if (failure) setError(failure);
      else setMessage('Capacity policy saved.');
    } catch (caught) {
      reportError(caught, { area: 'foundation', op: 'save' });
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { borderRadius: r(12), backgroundColor: t.SURFACE, borderColor: t.BORDER_SOLID }]}>
      <Text style={[font(15, '700'), styles.mb14, { color: t.TITLE }]}>Capacity policy</Text>
      <View style={styles.mb16}>
        <Text style={[font(12, '600'), styles.mb6, { color: t.MUTED }]}>Quota state</Text>
        <QuotaButtons value={form.quotaState} onChange={(quotaState) => setForm((prev) => ({ ...prev, quotaState }))} />
      </View>
      <View style={styles.fields}>
        {NUMERIC_FIELDS.map((f) => (
          <View key={f.key}>
            <Text style={[font(12, '600'), styles.mb6, { color: t.MUTED }]}>{f.label}</Text>
            <TextInput
              value={String(form[f.key])}
              onChangeText={(raw) => setNumber(f.key, raw)}
              keyboardType="number-pad"
              accessibilityLabel={f.label}
              style={[font(14), styles.input, { borderRadius: r(8), backgroundColor: t.INPUT_BG, borderColor: t.BORDER_SOLID, color: t.TITLE }]}
            />
          </View>
        ))}
      </View>
      {error ? <Text style={[font(13), styles.mb12, styles.error]} accessibilityRole="alert">{error}</Text> : null}
      {message ? <Text style={[font(13), styles.mb12, { color: t.ACCENT }]}>{message}</Text> : null}
      <FDButton
        label={saving ? 'Saving…' : 'Save policy'}
        disabled={saving}
        look={{ bg: saving ? `${t.ACCENT}66` : t.ACCENT, color: '#06210F' }}
        weight="800"
        pad={[11, 18]}
        radius={10}
        size={14}
        onPress={() => void save()}
      />
    </View>
  );
}

export function FoundationAdmin() {
  const { t } = useFDTheme();
  const { form, loadError, refreshing, refresh } = usePolicy();
  if (!form && !loadError) return <LoadingScreen />;
  return (
    <ScrollView
      style={[styles.bleed, { backgroundColor: t.BG }]}
      contentContainerStyle={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.ACCENT} colors={[t.ACCENT]} />}
    >
      {loadError ? <Text style={[font(13), styles.mb12, styles.error]} accessibilityRole="alert">{loadError}</Text> : null}
      {form ? <PolicyCard key={JSON.stringify(form)} initial={form} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  body: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 48 },
  card: { padding: 16, borderWidth: 1 },
  quotaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quota: { paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1 },
  capitalize: { textTransform: 'capitalize' },
  fields: { gap: 12, marginBottom: 16 },
  input: { paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1 },
  error: { color: '#EF4444' },
  mb6: { marginBottom: 6 },
  mb12: { marginBottom: 12 },
  mb14: { marginBottom: 14 },
  mb16: { marginBottom: 16 },
});
