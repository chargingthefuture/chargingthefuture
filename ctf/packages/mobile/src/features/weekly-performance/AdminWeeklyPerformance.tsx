import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import {
  fetchCurrentWeek,
  fetchWeekMetrics,
  fetchWeeks,
  WeekMetric,
  WeekRow,
} from './api';

// Admin surface for Weekly Performance. Real endpoints only. Tabs: Metrics, History.
// Numbers are always live (there is no "close the week" step), so this is a read/review tool:
// pick a week in History, see its live metrics. It does not mark a week "active".

// Metric-series palette — dashboard data colors, deliberately raw (not theme tokens).
// '#6366F1' here is the engagements series color, which happens to equal the plugin accent.
const METRIC_CONFIG: Record<string, { label: string; color: string }> = {
  member_count: { label: 'Members', color: '#A78BFA' },
  signups: { label: 'Sign-ups', color: '#22C55E' },
  engagements: { label: 'Engagements', color: '#6366F1' },
  gdp_delta: { label: 'GDP Delta', color: '#06B6D4' },
};

const METRIC_FALLBACK_COLOR = '#A78BFA';

function humanizeMetricKey(key: string): string {
  return key
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function metricConfig(key: string): { label: string; color: string } {
  return METRIC_CONFIG[key] ?? { label: humanizeMetricKey(key), color: METRIC_FALLBACK_COLOR };
}

type Tab = 'metrics' | 'history';

function useWpAdminStyles() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('weekly-performance', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return { tokens, accent, styles };
}

function NotAdmin() {
  const { styles } = useWpAdminStyles();
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
  const { tokens, accent, styles } = useWpAdminStyles();
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

  if (authLoading) {
    return (
      <View style={styles.centerRoot}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }
  if (!isAuthenticated || !isAdmin) return <NotAdmin />;

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
        {/* Review-week summary (shown on both tabs). Pick a week in the History tab. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review week</Text>
          <Text style={styles.cardSub}>
            Current week: {currentWeekStart ?? 'not set'} · Tracked weeks: {weeks.length}
          </Text>
          {selectedWeek ? (
            <Text style={styles.selectedLabel}>
              Viewing: {selectedWeek.weekStartDate} – {selectedWeek.weekEndDate}
              {selectedWeek.weekStartDate === currentWeekStart ? ' · Live' : ''}
            </Text>
          ) : null}
        </View>

        {dataLoading ? (
          <ActivityIndicator size="large" color={accent} style={styles.spinner} />
        ) : weeks.length === 0 ? (
          <Text style={styles.noDataText}>No weeks are tracked yet.</Text>
        ) : tab === 'metrics' ? (
          metricsLoading ? (
            <ActivityIndicator size="large" color={accent} style={styles.spinner} />
          ) : metrics.length === 0 ? (
            <Text style={styles.noDataText}>No metric data available for this week.</Text>
          ) : (
            <View style={styles.metricsGrid}>
              {metrics.map((m) => {
                const cfg = metricConfig(m.metricKey);
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
                    setTab('metrics');
                  }}
                  accessibilityRole="button"
                >
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyItemLabel}>
                      {w.weekStartDate} – {w.weekEndDate}
                    </Text>
                    <Text style={[styles.historyItemStatus, { color: isCurrent ? tokens.success : tokens.textSecondary }]}>
                      {isCurrent ? 'Live' : 'Historical'}
                    </Text>
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

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    centerRoot: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
    notAdminTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, marginBottom: 8 },
    notAdminSub: { fontSize: 13, color: t.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.surfaceAlt,
    },
    headerIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: `${accent}20`,
      borderWidth: 1,
      borderColor: `${accent}35`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    headerIconText: { fontSize: 16 },
    headerTextWrap: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: t.textPrimary },
    headerSub: { fontSize: 11, color: t.textSecondary, marginTop: 1 },
    // ADMIN badge — the shared raw indigo triplet used on every admin surface; stays raw.
    adminBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: t.radiusChip,
      backgroundColor: 'rgba(99,102,241,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(99,102,241,0.3)',
    },
    adminBadgeText: { fontSize: 9, fontWeight: '700', color: '#818CF8' },

    tabBar: {
      flexDirection: 'row',
      gap: 4,
      padding: 8,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    tabBtnActive: { backgroundColor: `${accent}20`, borderColor: `${accent}40` },
    tabBtnText: { fontSize: 12, fontWeight: '400', color: t.textSecondary },
    tabBtnTextActive: { fontWeight: '700', color: accent },

    scrollArea: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 32, gap: 12 },

    card: {
      padding: 14,
      borderRadius: t.radius,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    cardTitle: { fontSize: 13, fontWeight: '700', color: t.textPrimary, marginBottom: 4 },
    cardSub: { fontSize: 12, color: t.textSecondary, marginBottom: 8 },
    selectedLabel: { fontSize: 12, color: t.textPrimary, marginBottom: 2 },

    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metricCard: {
      width: '47%',
      padding: 14,
      borderRadius: t.radius,
      backgroundColor: t.surface,
      borderWidth: 1,
    },
    metricCardLabel: { fontSize: 10, color: t.textSecondary, marginBottom: 6 },
    metricCardValue: { fontSize: 22, fontWeight: '800' },
    noDataText: { fontSize: 14, color: t.textSecondary, textAlign: 'center', marginTop: 24 },

    historyList: { gap: 8 },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: t.radius,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    historyItemSelected: { borderColor: accent },
    historyItemContent: { flex: 1 },
    historyItemLabel: { fontSize: 13, fontWeight: '600', color: t.textPrimary },
    historyItemStatus: { fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
    currentBadge: {
      fontSize: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      fontWeight: '700',
      overflow: 'hidden',
      backgroundColor: `${accent}15`,
      color: accent,
    },

    spinner: { marginTop: 24 },
    errorText: { color: t.danger, fontSize: 13, textAlign: 'center', padding: 12 },
  });
}
