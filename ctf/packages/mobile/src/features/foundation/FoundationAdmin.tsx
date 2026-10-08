// Foundation Admin, copied from the web FoundationAdminShell (foundation-admin-shell.tsx): the snapshot
// counts (GET /api/foundation/admin/dashboard, the same query the web page runs on its server), then the
// capacity policy with the quota state and the five limits, and Save policy. Reached from the Admin pill
// in the Foundation header, which shows to admins only. The header's refresh button reloads both and
// starts the form again, as the web admin refresh does.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  fetchAdminDashboard,
  fetchCapacityPolicy,
  saveCapacityPolicy,
  type AdminDashboard,
  type CapacityPolicyForm,
  type QuotaState,
} from './FoundationDataApi';
import { useScreenOverride } from '../../components/shell/ScreenOverride';
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

function useAdminData() {
  const [form, setForm] = useState<CapacityPolicyForm | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await fetchAdminDashboard());
    } catch (caught) {
      reportError(caught, { area: 'foundation', op: 'admin_dashboard_read' });
      setLoadError(caught instanceof Error ? caught.message : 'Admin snapshot unavailable.');
    }
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setForm(await fetchCapacityPolicy());
    } catch (caught) {
      reportError(caught, { area: 'foundation', op: 'admin_capacity_policy_read' });
      setLoadError(caught instanceof Error ? caught.message : 'Capacity policy unavailable.');
    }
    await loadDashboard();
    setRound((n) => n + 1);
  }, [loadDashboard]);

  useEffect(() => {
    void load();
  }, [load]);

  return { form, dashboard, loadError, round, load, loadDashboard };
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { t, r } = useFDTheme();
  return (
    <View style={[styles.stat, { borderRadius: r(10), backgroundColor: t.SURFACE, borderColor: t.BORDER_SOLID }]}>
      <Text style={[font(20, '800'), { color: accent ?? t.TITLE }]}>{value}</Text>
      <Text style={[font(11), styles.mt2, { color: t.MUTED }]}>{label}</Text>
    </View>
  );
}

function Snapshot({ dashboard }: { dashboard: AdminDashboard }) {
  const { t } = useFDTheme();
  return (
    <>
      <View style={styles.stats}>
        <StatBlock label="Providers" value={dashboard.providersTotal} accent={t.ACCENT} />
        <StatBlock label="Threads" value={dashboard.threadsTotal} />
        <StatBlock label="Quote requests" value={dashboard.quotesTotal} />
        <StatBlock label="Active calls" value={dashboard.activeCallsTotal} />
        <StatBlock label="Pending notifications" value={dashboard.pendingNotificationsTotal} accent="#F59E0B" />
      </View>
      <Text style={[font(11), styles.mb20, { color: t.MUTED }]}>Snapshot generated {new Date(dashboard.generatedAtIso).toLocaleString()}</Text>
    </>
  );
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

function PolicyCard({ initial, onSaved }: { initial: CapacityPolicyForm; onSaved: () => void }) {
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
      else {
        setMessage('Capacity policy saved.');
        onSaved();
      }
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
  const { form, dashboard, loadError, round, load, loadDashboard } = useAdminData();
  const override = useMemo(() => ({ refresh: { onRefresh: load, admin: true } }), [load]);
  useScreenOverride(override);
  if (round === 0) return <LoadingScreen />;
  return (
    <ScrollView style={[styles.bleed, { backgroundColor: t.BG }]} contentContainerStyle={styles.body}>
      {dashboard ? <Snapshot dashboard={dashboard} /> : null}
      {loadError ? <Text style={[font(13), styles.mb12, styles.error]} accessibilityRole="alert">{loadError}</Text> : null}
      {form ? <PolicyCard key={round} initial={form} onSaved={() => void loadDashboard()} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  body: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 48 },
  card: { padding: 16, borderWidth: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  stat: { flexGrow: 1, flexBasis: 110, minWidth: 110, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1 },
  mt2: { marginTop: 2 },
  mb20: { marginBottom: 20 },
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
