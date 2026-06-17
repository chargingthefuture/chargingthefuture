import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import {
  fetchAdminOverview,
  runAdminRecompute,
  runAdminSync,
  updateAdminConfig,
  type WorkforceConfig,
  type WorkforceDashboard,
} from './admin-api';

const COLOR = '#F97316';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

export const AdminWorkforce = () => {
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [config, setConfig] = useState<WorkforceConfig | null>(null);
  const [dashboard, setDashboard] = useState<WorkforceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'config' | 'sync' | 'recompute' | null>(null);

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
    setConfig(result.config);
    setDashboard(result.dashboard);
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const persistConfig = useCallback(
    async (next: WorkforceConfig) => {
      if (!auth?.userId) return;
      setBusy('config');
      setError(null);
      setNotice(null);
      try {
        const saved = await updateAdminConfig(next);
        setConfig(saved);
        setNotice('Config saved.');
      } catch {
        setError('Could not save the config. Try again.');
        await load();
      } finally {
        setBusy(null);
      }
    },
    [auth, load],
  );

  const toggleExports = useCallback(
    (value: boolean) => {
      if (!config) return;
      void persistConfig({ ...config, exportsEnabled: value });
    },
    [config, persistConfig],
  );

  const runSync = useCallback(() => {
    if (!auth?.userId) return;
    Alert.alert('Run incremental sync', 'Run the recruited incremental sync now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Run',
        onPress: async () => {
          setBusy('sync');
          setError(null);
          setNotice(null);
          try {
            await runAdminSync();
            setNotice('Incremental sync started.');
            await load();
          } catch {
            setError('Could not run the sync. Try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }, [auth, load]);

  const runRecompute = useCallback(() => {
    if (!auth?.userId) return;
    Alert.alert('Recompute recruited totals', 'Enqueue a recruited-total recompute now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Recompute',
        onPress: async () => {
          setBusy('recompute');
          setError(null);
          setNotice(null);
          try {
            await runAdminRecompute();
            setNotice('Recompute enqueued.');
          } catch {
            setError('Could not enqueue the recompute. Try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }, [auth]);

  if (authLoading || (loading && !forbidden && error === null)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR} />
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
        { label: 'Workforce total', value: dashboard.workforceTotal, color: COLOR },
        { label: 'Recruited total', value: dashboard.recruitedTotal, color: '#22C55E' },
        { label: 'Occupations', value: dashboard.occupationsTotal, color: '#A78BFA' },
        { label: 'Active announcements', value: dashboard.activeAnnouncementsTotal, color: '#F59E0B' },
      ]
    : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workforce Admin</Text>
      <Text style={styles.subtitle}>Operational controls: config, sync, and recompute.</Text>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

      {summary.length > 0 ? (
        <View style={styles.statGrid}>
          {summary.map((item) => (
            <React.Fragment key={item.label}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
            </View>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {config ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Config</Text>
          <View style={styles.switchRow}>
            <Switch value={config.exportsEnabled} onValueChange={toggleExports} disabled={busy === 'config'} />
            <Text style={styles.switchLabel}>Exports enabled</Text>
          </View>
          <Text style={styles.cardMeta}>Report timezone: {config.reportWeekTimezone}</Text>
          <Text style={styles.cardMeta}>Week start day-of-week: {config.reportWeekStartDow}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Operations</Text>
        <Pressable
          style={[styles.primaryBtn, busy === 'sync' ? styles.btnBusy : null]}
          onPress={runSync}
          disabled={busy !== null}
        >
          {busy === 'sync' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Run incremental sync</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, busy === 'recompute' ? styles.btnBusy : null]}
          onPress={runRecompute}
          disabled={busy !== null}
        >
          {busy === 'recompute' ? (
            <ActivityIndicator size="small" color={COLOR} />
          ) : (
            <Text style={styles.secondaryBtnText}>Recompute recruited totals</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '800', color: TEXT },
  subtitle: { fontSize: 13, color: SUBTLE, lineHeight: 19 },
  noticeText: { fontSize: 14, color: SUBTLE, textAlign: 'center' },
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
    borderRadius: 12,
    padding: 14,
  },
  statLabel: { fontSize: 11, color: SUBTLE, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  card: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  cardMeta: { fontSize: 12, color: SUBTLE, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 13, color: '#D1D5DB', flex: 1 },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: COLOR,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLOR,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: COLOR },
  btnBusy: { opacity: 0.6 },
});
