import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../auth/auth-context';
import {
  fetchCurrentWeek,
  fetchWeekMetrics,
  fetchWeeks,
  selectActiveWeek,
  WeekMetric,
  WeekRow,
} from './api';

// Admin surface for Weekly Performance, aligned to
// design/.../survivor-hub/MobileWeeklyPerformanceAdminView.tsx.
// Real endpoints only: the mockup's fabricated plugin-breakdown and daily bar
// chart are omitted (no backing API field). Tabs: Metrics, History.
// Actions: set the active week (PUT /api/weekly-performance/admin/week-selection).

const BRAND = '#F59E0B';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const STATUS_BG = '#090B0F';

const METRIC_CONFIG: Record<string, { label: string; color: string }> = {
  member_count: { label: 'Members', color: '#A78BFA' },
  signups: { label: 'Sign-ups', color: '#22C55E' },
  engagements: { label: 'Engagements', color: BRAND },
  gdp_delta: { label: 'GDP Delta', color: '#06B6D4' },
};

type Tab = 'metrics' | 'history';

type Feedback = { kind: 'success' | 'error'; text: string } | null;

function statusColor(status: WeekRow['status']): string {
  if (status === 'open') return '#22C55E';
  if (status === 'published') return '#06B6D4';
  return SUBTLE;
}

function NotAdmin() {
  return (
    <View style={styles.centerRoot}>
      <Text style={styles.notAdminTitle}>Admin access required</Text>
      <Text style={styles.notAdminSub}>
        The Weekly Performance admin view is available to administrators only.
      </Text>
    </View>
  );
}

export const AdminWeeklyPerformance: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [tab, setTab] = useState<Tab>('metrics');
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeekRow | null>(null);
  const [metrics, setMetrics] = useState<WeekMetric[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selecting, setSelecting] = useState(false);

  const loadWeeks = useCallback(() => {
    setDataLoading(true);
    setError(null);
    return Promise.all([fetchWeeks(), fetchCurrentWeek()])
      .then(([weeksRes, currentRes]) => {
        const loadedWeeks = weeksRes.weeks ?? [];
        const current = currentRes.currentWeek ?? null;
        setWeeks(loadedWeeks);
        setCurrentWeekStart(current?.weekStartDate ?? null);
        setSelectedWeek((prev) => prev ?? current ?? loadedWeeks[0] ?? null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load data');
      })
      .finally(() => setDataLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    void loadWeeks();
  }, [isAuthenticated, isAdmin, loadWeeks]);

  useEffect(() => {
    if (!selectedWeek) {
      setMetrics([]);
      return;
    }
    let active = true;
    setMetricsLoading(true);
    fetchWeekMetrics(selectedWeek.weekStartDate)
      .then((res) => {
        if (active) setMetrics(res.metrics ?? []);
      })
      .catch(() => {
        if (active) setMetrics([]);
      })
      .finally(() => {
        if (active) setMetricsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedWeek]);

  function onSelectActiveWeek() {
    if (!selectedWeek || selecting) return;
    setSelecting(true);
    setFeedback(null);
    selectActiveWeek(selectedWeek.weekStartDate)
      .then((res) => {
        setFeedback({ kind: 'success', text: `Active week set to ${res.selectedWeek?.weekStartDate ?? selectedWeek.weekStartDate}.` });
        return loadWeeks();
      })
      .catch((e: unknown) => {
        setFeedback({ kind: 'error', text: e instanceof Error ? e.message : 'Could not set the active week.' });
      })
      .finally(() => setSelecting(false));
  }

  if (authLoading) {
    return (
      <View style={styles.centerRoot}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }
  if (!isAuthenticated || !isAdmin) return <NotAdmin />;

  const knownMetrics = metrics.filter((m) => m.metricKey in METRIC_CONFIG);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Text style={styles.headerIconText}>📊</Text>
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Weekly Performance</Text>
          <Text style={styles.headerSub}>Admin view</Text>
        </View>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['metrics', 'history'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Active-week selection control (shown on both tabs) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active week</Text>
          <Text style={styles.cardSub}>
            Current week: {currentWeekStart ?? 'not set'} · Tracked weeks: {weeks.length}
          </Text>
          {selectedWeek ? (
            <Text style={styles.selectedLabel}>
              Selected: {selectedWeek.weekStartDate} – {selectedWeek.weekEndDate}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, (selecting || !selectedWeek) && styles.primaryBtnDisabled]}
            onPress={onSelectActiveWeek}
            disabled={selecting || !selectedWeek}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {selecting ? 'Setting…' : 'Set selected week as active'}
            </Text>
          </TouchableOpacity>
          {feedback ? (
            <Text style={[styles.feedbackText, feedback.kind === 'success' ? styles.feedbackOk : styles.feedbackErr]}>
              {feedback.text}
            </Text>
          ) : null}
        </View>

        {dataLoading ? (
          <ActivityIndicator size="large" color={BRAND} style={styles.spinner} />
        ) : weeks.length === 0 ? (
          <Text style={styles.noDataText}>No weeks are tracked yet.</Text>
        ) : tab === 'metrics' ? (
          metricsLoading ? (
            <ActivityIndicator size="large" color={BRAND} style={styles.spinner} />
          ) : knownMetrics.length === 0 ? (
            <Text style={styles.noDataText}>No metric data available for this week.</Text>
          ) : (
            <View style={styles.metricsGrid}>
              {knownMetrics.map((m) => {
                const cfg = METRIC_CONFIG[m.metricKey];
                const displayValue =
                  m.metricUnit === 'USD'
                    ? `$${m.metricValue.toLocaleString()}`
                    : m.metricValue.toLocaleString();
                return (
                  <React.Fragment key={m.metricKey}>
                    <View style={[styles.metricCard, { borderColor: `${cfg.color}20` }]}>
                      <Text style={styles.metricCardLabel}>{cfg.label}</Text>
                      <Text style={[styles.metricCardValue, { color: cfg.color }]}>{displayValue}</Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          )
        ) : (
          <View style={styles.historyList}>
            {weeks.map((w) => {
              const isSelected = w.weekStartDate === selectedWeek?.weekStartDate;
              const isCurrent = w.weekStartDate === currentWeekStart;
              return (
                <TouchableOpacity
                  key={w.weekStartDate}
                  style={[styles.historyItem, isSelected && styles.historyItemSelected]}
                  onPress={() => {
                    setSelectedWeek(w);
                    setFeedback(null);
                    setTab('metrics');
                  }}
                  accessibilityRole="button"
                >
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyItemLabel}>
                      {w.weekStartDate} – {w.weekEndDate}
                    </Text>
                    <Text style={[styles.historyItemStatus, { color: statusColor(w.status) }]}>{w.status}</Text>
                  </View>
                  {isCurrent ? <Text style={styles.currentBadge}>CURRENT</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centerRoot: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notAdminTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 8 },
  notAdminSub: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: STATUS_BG,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: `${BRAND}20`,
    borderWidth: 1,
    borderColor: `${BRAND}35`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerIconText: { fontSize: 16 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  headerSub: { fontSize: 11, color: SUBTLE, marginTop: 1 },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  adminBadgeText: { fontSize: 9, fontWeight: '700', color: '#818CF8' },

  tabBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 8,
    backgroundColor: STATUS_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: `${BRAND}20`, borderColor: `${BRAND}40` },
  tabBtnText: { fontSize: 12, fontWeight: '400', color: SUBTLE },
  tabBtnTextActive: { fontWeight: '700', color: BRAND },

  scrollArea: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 32, gap: 12 },

  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 4 },
  cardSub: { fontSize: 12, color: SUBTLE, marginBottom: 8 },
  selectedLabel: { fontSize: 12, color: TEXT, marginBottom: 10 },
  primaryBtn: {
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: BRAND,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: `${BRAND}60` },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#0F1117' },
  feedbackText: { fontSize: 12, marginTop: 10 },
  feedbackOk: { color: '#22C55E' },
  feedbackErr: { color: '#EF4444' },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '47%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
  },
  metricCardLabel: { fontSize: 10, color: SUBTLE, marginBottom: 6 },
  metricCardValue: { fontSize: 22, fontWeight: '800' },
  noDataText: { fontSize: 14, color: SUBTLE, textAlign: 'center', marginTop: 24 },

  historyList: { gap: 8 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  historyItemSelected: { borderColor: BRAND },
  historyItemContent: { flex: 1 },
  historyItemLabel: { fontSize: 13, fontWeight: '600', color: TEXT },
  historyItemStatus: { fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  currentBadge: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: '700',
    overflow: 'hidden',
    backgroundColor: `${BRAND}15`,
    color: BRAND,
  },

  spinner: { marginTop: 24 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', padding: 12 },
});
