import React, { useEffect, useState } from 'react';
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
  WeekMetric,
  WeekRow,
} from './api';

// ── Brand tokens (from MobileWeeklyPerformance.tsx mockup) ──────────────────
const BRAND = '#F59E0B';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const STATUS_BG = '#090B0F';

// Known metric keys and their display config.
// Keys must match values in weekly_performance_metrics.metric_key exactly.
const METRIC_CONFIG: Record<string, { label: string; color: string }> = {
  member_count: { label: 'Members', color: '#A78BFA' },
  signups: { label: 'Sign-ups', color: '#22C55E' },
  engagements: { label: 'Engagements', color: BRAND },
  gdp_delta: { label: 'GDP Delta', color: '#06B6D4' },
};

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'metrics' | 'history';

// ── Loading state ────────────────────────────────────────────────────────────

function WpLoading() {
  return (
    <View style={styles.loadingRoot}>
      <Text style={styles.loadingLine}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.loadingLine}>EXIT THE PSYOP</Text>
    </View>
  );
}

// ── Public (unauthenticated) state ───────────────────────────────────────────

const BLURRED_LABELS = [
  { label: 'Members', color: '#A78BFA' },
  { label: 'Sign-ups', color: '#22C55E' },
  { label: 'Engagements', color: BRAND },
  { label: 'GDP Delta', color: '#06B6D4' },
];

function WpPublic() {
  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.publicHeader}>
        <Text style={styles.headerTitle}>Weekly Performance</Text>
      </View>
      {/* Hero */}
      <View style={styles.publicHero}>
        <Text style={styles.publicHeroTitle}>See how the platform grows</Text>
        <Text style={styles.publicHeroSub}>
          Member growth, plugin engagement, and GDP delta — tracked week over week.
        </Text>
      </View>
      {/* Blurred preview with lock overlay */}
      <View style={styles.blurredContainer}>
        <View style={styles.blurredCards}>
          {BLURRED_LABELS.map(({ label, color }) => (
            <React.Fragment key={label}>
              <View
                style={[styles.metricCard, { borderColor: `${color}20`, opacity: 0.3 }]}
              >
                <Text style={styles.metricCardLabel}>{label}</Text>
                <Text style={[styles.metricCardValue, { color }]}>—</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        <View style={styles.lockOverlay}>
          <View style={styles.lockCircle}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
          <Text style={styles.lockText}>Sign in to view metrics</Text>
        </View>
      </View>
      {/* Bottom nav (locked/dimmed) */}
      <View style={styles.bottomNav}>
        {(['Metrics', 'History', 'Trends'] as const).map((label) => (
          <React.Fragment key={label}>
            <View style={styles.navItemDimmed}>
              <Text style={styles.navLabelDimmed}>{label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ── Empty state (authenticated, no metrics yet) ──────────────────────────────

function WpEmpty({ weekLabel }: { weekLabel: string }) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weekly Performance</Text>
        <Text style={styles.headerSub}>{weekLabel}</Text>
      </View>
      <View style={styles.emptyBody}>
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>📊</Text>
        </View>
        <Text style={styles.emptyTitle}>Week in progress</Text>
        <Text style={styles.emptySub}>
          Metrics will populate when an admin closes the week. Check back at the end of the week.
        </Text>
        {/* Placeholder metric cards */}
        <View style={styles.metricsGrid}>
          {BLURRED_LABELS.map(({ label, color }) => (
            <React.Fragment key={label}>
              <View style={[styles.metricCard, { borderColor: `${color}15` }]}>
                <Text style={[styles.metricCardLabel, styles.metricCardLabelUpper]}>{label}</Text>
                <Text style={[styles.metricCardValue, { color: SUBTLE }]}>—</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
      <WpBottomNav activeTab="metrics" onTabPress={() => undefined} />
    </View>
  );
}

// ── Metric cards (populated) ─────────────────────────────────────────────────

function WpMetricCards({ metrics }: { metrics: WeekMetric[] }) {
  const knownMetrics = metrics.filter((m) => m.metricKey in METRIC_CONFIG);

  if (knownMetrics.length === 0) {
    return (
      <Text style={styles.noDataText}>
        {/* No known metric fields available for this week — daily chart omitted (no backing API field). */}
        No metric data available for this week.
      </Text>
    );
  }

  return (
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
              {m.metricUnit && m.metricUnit !== 'count' && m.metricUnit !== 'USD' && (
                <Text style={styles.metricCardUnit}>{m.metricUnit}</Text>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
    // NOTE: The mockup's "Daily Engagements" bar chart has no backing API field
    // (metrics are weekly aggregates only). Omitted per real-data-only policy.
  );
}

// ── History tab ──────────────────────────────────────────────────────────────

function WpHistory({
  weeks,
  selectedWeekStartDate,
  onSelectWeek,
  isAdmin,
}: {
  weeks: WeekRow[];
  selectedWeekStartDate: string | null;
  onSelectWeek: (_w: WeekRow) => void;
  isAdmin: boolean;
}) {
  return (
    <ScrollView contentContainerStyle={styles.historyList}>
      {weeks.map((w) => {
        const isActive = w.status === 'open';
        const isSelected = w.weekStartDate === selectedWeekStartDate;
        return (
          <TouchableOpacity
            key={w.weekStartDate}
            style={[styles.historyItem, isSelected && styles.historyItemSelected]}
            onPress={() => onSelectWeek(w)}
            accessibilityRole="button"
          >
            <View style={styles.historyItemContent}>
              <Text style={styles.historyItemLabel}>
                {w.weekStartDate} – {w.weekEndDate}
              </Text>
              <Text style={styles.historyItemStatus}>{w.status}</Text>
            </View>
            <Text
              style={[styles.historyBadge, isActive ? styles.historyBadgeLive : styles.historyBadgeView]}
            >
              {isActive ? 'LIVE' : 'View'}
            </Text>
          </TouchableOpacity>
        );
      })}
      {!isAdmin && (
        <View style={styles.exportHint}>
          <Text style={styles.exportHintText}>CSV export is admin-only</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Bottom nav ───────────────────────────────────────────────────────────────

function WpBottomNav({
  activeTab,
  onTabPress,
}: {
  activeTab: Tab;
  onTabPress: (_tab: Tab) => void;
}) {
  const TABS: { key: Tab; label: string }[] = [
    { key: 'metrics', label: 'Metrics' },
    { key: 'history', label: 'History' },
  ];
  return (
    <View style={styles.bottomNav}>
      {TABS.map(({ key, label }) => {
        const isActive = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.navItem}
            onPress={() => onTabPress(key)}
            accessibilityRole="tab"
          >
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
      {/* Trends tab — no backing route; shown dimmed per mockup */}
      <View style={styles.navItem}>
        <Text style={styles.navLabelDimmed}>Trends</Text>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export const WeeklyPerformance: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [tab, setTab] = useState<Tab>('metrics');
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekRow | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeekRow | null>(null);
  const [metrics, setMetrics] = useState<WeekMetric[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch weeks + current week when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    setError(null);
    Promise.all([fetchWeeks(), fetchCurrentWeek()])
      .then(([weeksRes, currentRes]) => {
        const loadedWeeks = weeksRes.weeks ?? [];
        const loaded = currentRes.currentWeek ?? null;
        setWeeks(loadedWeeks);
        setCurrentWeek(loaded);
        setSelectedWeek(loaded ?? loadedWeeks[0] ?? null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load data');
      })
      .finally(() => setDataLoading(false));
  }, [isAuthenticated]);

  // Fetch metrics whenever selected week changes
  useEffect(() => {
    if (!selectedWeek) return;
    setMetricsLoading(true);
    setError(null);
    fetchWeekMetrics(selectedWeek.weekStartDate)
      .then((res) => setMetrics(res.metrics ?? []))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load metrics');
      })
      .finally(() => setMetricsLoading(false));
  }, [selectedWeek]);

  if (authLoading) return <WpLoading />;
  if (!isAuthenticated) return <WpPublic />;
  if (dataLoading) return <WpLoading />;

  const weekLabel = selectedWeek
    ? `${selectedWeek.weekStartDate} – ${selectedWeek.weekEndDate} · ${selectedWeek.status}`
    : currentWeek
      ? `${currentWeek.weekStartDate} – ${currentWeek.weekEndDate} · ${currentWeek.status}`
      : '';

  const hasMetrics = metrics.some((m) => m.metricKey in METRIC_CONFIG);
  const weekIsOpen = selectedWeek?.status === 'open' || currentWeek?.status === 'open';

  if (!dataLoading && !error && weeks.length === 0) {
    return <WpEmpty weekLabel={weekLabel} />;
  }

  if (!dataLoading && !metricsLoading && !error && !hasMetrics && weekIsOpen) {
    return <WpEmpty weekLabel={weekLabel} />;
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Text style={styles.headerIconText}>📊</Text>
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Weekly Performance</Text>
          {weekLabel ? <Text style={styles.headerSub}>{weekLabel}</Text> : null}
        </View>
        {isAdmin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        )}
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

      {/* Error banner */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Content */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {tab === 'metrics' && (
          metricsLoading
            ? <ActivityIndicator size="large" color={BRAND} style={styles.spinner} />
            : <WpMetricCards metrics={metrics} />
        )}
        {tab === 'history' && (
          <WpHistory
            weeks={weeks}
            selectedWeekStartDate={selectedWeek?.weekStartDate ?? null}
            onSelectWeek={(w) => { setSelectedWeek(w); setTab('metrics'); }}
            isAdmin={isAdmin}
          />
        )}
      </ScrollView>

      <WpBottomNav activeTab={tab} onTabPress={setTab} />
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Loading
  loadingRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingLine: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },

  // Header
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
    backgroundColor: `${BRAND}20`,
    borderWidth: 1,
    borderColor: `${BRAND}40`,
  },
  adminBadgeText: { fontSize: 9, fontWeight: '700', color: BRAND },

  // Tab bar
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

  // Scroll
  scrollArea: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 88 },

  // Metrics grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '47%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
  },
  metricCardLabel: { fontSize: 10, color: SUBTLE, marginBottom: 6 },
  metricCardLabelUpper: { textTransform: 'uppercase', letterSpacing: 1 },
  metricCardValue: { fontSize: 22, fontWeight: '800' },
  metricCardUnit: { fontSize: 10, color: SUBTLE, marginTop: 2 },
  noDataText: { fontSize: 14, color: SUBTLE, textAlign: 'center', marginTop: 32 },

  // History
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
  historyItemStatus: { fontSize: 11, color: SUBTLE, marginTop: 2 },
  historyBadge: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: '600',
    overflow: 'hidden',
  },
  historyBadgeLive: {
    backgroundColor: `${BRAND}15`,
    color: BRAND,
  },
  historyBadgeView: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: SUBTLE,
  },
  exportHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 4,
  },
  exportHintText: { fontSize: 11, color: SUBTLE },

  // Bottom nav
  bottomNav: {
    height: 72,
    backgroundColor: STATUS_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  navLabel: { fontSize: 10, fontWeight: '400', color: SUBTLE },
  navLabelActive: { fontWeight: '600', color: BRAND },
  navItemDimmed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    opacity: 0.4,
  },
  navLabelDimmed: { fontSize: 10, color: SUBTLE },

  // Public
  publicHeader: {
    padding: 12,
    backgroundColor: `${BRAND}10`,
    borderBottomWidth: 1,
    borderBottomColor: `${BRAND}25`,
    alignItems: 'center',
  },
  publicHero: { padding: 20 },
  publicHeroTitle: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: 8 },
  publicHeroSub: { fontSize: 13, color: SUBTLE, lineHeight: 21 },
  blurredContainer: { flex: 1, padding: 16, position: 'relative' },
  blurredCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  lockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: `${BRAND}50`,
    backgroundColor: `${BRAND}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: { fontSize: 18 },
  lockText: { fontSize: 14, fontWeight: '700', color: TEXT, textAlign: 'center' },

  // Empty
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: `${BRAND}10`,
    borderWidth: 1,
    borderColor: `${BRAND}25`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: { fontSize: 30 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: TEXT },
  emptySub: { fontSize: 13, color: SUBTLE, lineHeight: 21, textAlign: 'center', maxWidth: 300 },

  // Misc
  spinner: { marginTop: 32 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', padding: 12 },
});
