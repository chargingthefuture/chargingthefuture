import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
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

// ── Brand tokens (from MobileWeeklyPerformance.tsx mockup) ──────────────────
// The ADMIN badge indigo — the shared raw admin-badge color used on every admin surface. It equals
// the weekly-performance accent by coincidence; the badge deliberately stays raw (not themed).
const ADMIN_INDIGO = '#6366F1';

// Display config for well-known metric keys. Any other key is rendered generically with a
// humanized label (the web shell does the same), so live engagement numbers show without a
// hardcoded entry per key.
// Metric-series palette — dashboard data colors, deliberately raw (not theme tokens).
// '#6366F1' here is the engagements series color, which happens to equal the plugin accent.
const METRIC_CONFIG: Record<string, { label: string; color: string }> = {
  member_count: { label: 'Members', color: '#A78BFA' },
  signups: { label: 'Sign-ups', color: '#22C55E' },
  engagements: { label: 'Engagements', color: '#6366F1' },
  gdp_delta: { label: 'GDP Delta', color: '#06B6D4' },
};

const METRIC_FALLBACK_COLOR = '#A78BFA';

// Turn a dotted/snake metric key (e.g. "engagement.active_members") into a readable label.
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

// ── Theme wiring ─────────────────────────────────────────────────────────────

function useWpStyles() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('weekly-performance', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return { tokens, accent, styles };
}

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'metrics' | 'history';

// ── Loading state ────────────────────────────────────────────────────────────

function WpLoading() {
  const { styles } = useWpStyles();
  return (
    <View style={styles.loadingRoot}>
      <Text style={styles.loadingLine}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.loadingLine}>EXIT THE PSYOP</Text>
    </View>
  );
}

// ── Public (unauthenticated) state ───────────────────────────────────────────

// Metric-series palette (same raw dashboard colors as METRIC_CONFIG).
const BLURRED_LABELS = [
  { label: 'Members', color: '#A78BFA' },
  { label: 'Sign-ups', color: '#22C55E' },
  { label: 'Engagements', color: '#6366F1' },
  { label: 'GDP Delta', color: '#06B6D4' },
];

// ── Access-restricted state (authenticated, but lacks admin/operations role) ──

function WpAccessRestricted() {
  const { styles } = useWpStyles();
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weekly Performance</Text>
      </View>
      <View style={styles.emptyBody}>
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>🔒</Text>
        </View>
        <Text style={styles.emptyTitle}>Access restricted</Text>
        <Text style={styles.emptySub}>
          Weekly Performance is available to administrators and the operations team only.
        </Text>
      </View>
    </View>
  );
}

function WpPublic() {
  const { styles } = useWpStyles();
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
  const { tokens, styles } = useWpStyles();
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
        <Text style={styles.emptyTitle}>Weekly numbers are updating</Text>
        <Text style={styles.emptySub}>
          Engagement numbers update live as members use the platform this week. They'll appear here in a moment.
        </Text>
        {/* Placeholder metric cards */}
        <View style={styles.metricsGrid}>
          {BLURRED_LABELS.map(({ label, color }) => (
            <React.Fragment key={label}>
              <View style={[styles.metricCard, { borderColor: `${color}15` }]}>
                <Text style={[styles.metricCardLabel, styles.metricCardLabelUpper]}>{label}</Text>
                <Text style={[styles.metricCardValue, { color: tokens.textSecondary }]}>—</Text>
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
  const { styles } = useWpStyles();
  if (metrics.length === 0) {
    return (
      <Text style={styles.noDataText}>
        No metric data available for this week.
      </Text>
    );
  }

  return (
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
  currentWeekStartDate,
  onSelectWeek,
}: {
  weeks: WeekRow[];
  selectedWeekStartDate: string | null;
  currentWeekStartDate: string | null;
  onSelectWeek: (_w: WeekRow) => void;
}) {
  const { styles } = useWpStyles();
  return (
    <ScrollView contentContainerStyle={styles.historyList}>
      {weeks.map((w) => {
        // The current week is live; every other week is a historical window (no "closed" state).
        const isCurrent = w.weekStartDate === currentWeekStartDate;
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
              <Text style={styles.historyItemStatus}>{isCurrent ? 'Live' : 'Historical'}</Text>
            </View>
            <Text
              style={[styles.historyBadge, isCurrent ? styles.historyBadgeLive : styles.historyBadgeView]}
            >
              {isCurrent ? 'LIVE' : 'View'}
            </Text>
          </TouchableOpacity>
        );
      })}
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
  const { styles } = useWpStyles();
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
  const { accent, styles } = useWpStyles();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  // The access-policy contract restricts every weekly-performance command to the
  // admin and operations roles. The API enforces this server-side; gate the screen
  // too so other authenticated members get a clear message, not silent API errors.
  const hasAccess = isAdmin || user?.role === 'operations';

  const [tab, setTab] = useState<Tab>('metrics');
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekRow | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeekRow | null>(null);
  const [metrics, setMetrics] = useState<WeekMetric[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch weeks + current week when authenticated and authorized
  useEffect(() => {
    if (!isAuthenticated || !hasAccess) return;
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
  }, [isAuthenticated, hasAccess]);

  // Fetch the selected week's metrics. Shared by the week-change effect (shows the spinner)
  // and pull-to-refresh (background=true, re-pulls without flashing the spinner).
  const loadMetrics = useCallback((background = false) => {
    if (!selectedWeek) return Promise.resolve();
    if (!background) setMetricsLoading(true);
    setError(null);
    return fetchWeekMetrics(selectedWeek.weekStartDate)
      .then((res) => setMetrics(res.metrics ?? []))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load metrics');
      })
      .finally(() => {
        if (!background) setMetricsLoading(false);
      });
  }, [selectedWeek]);

  // Fetch metrics whenever selected week changes
  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMetrics(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadMetrics]);

  if (authLoading) return <WpLoading />;
  if (!isAuthenticated) return <WpPublic />;
  if (!hasAccess) return <WpAccessRestricted />;
  if (dataLoading) return <WpLoading />;

  // The current week is the only live one (its window still contains today). Past weeks are
  // settled historical windows — there is no "closed" week and we never show a raw status.
  const currentWeekStartDate = currentWeek?.weekStartDate ?? null;
  const labelWeek = selectedWeek ?? currentWeek;
  const labelIsCurrent = !!labelWeek && labelWeek.weekStartDate === currentWeekStartDate;
  const weekLabel = labelWeek
    ? `${labelWeek.weekStartDate} – ${labelWeek.weekEndDate}${labelIsCurrent ? ' · Live' : ''}`
    : '';

  const hasMetrics = metrics.length > 0;
  const selectedIsCurrent = !!selectedWeek && selectedWeek.weekStartDate === currentWeekStartDate;

  if (!dataLoading && !error && weeks.length === 0) {
    return <WpEmpty weekLabel={weekLabel} />;
  }

  if (!dataLoading && !metricsLoading && !error && !hasMetrics && selectedIsCurrent) {
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
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {tab === 'metrics' && (
          metricsLoading
            ? <ActivityIndicator size="large" color={accent} style={styles.spinner} />
            : <WpMetricCards metrics={metrics} />
        )}
        {tab === 'history' && (
          <WpHistory
            weeks={weeks}
            selectedWeekStartDate={selectedWeek?.weekStartDate ?? null}
            currentWeekStartDate={currentWeekStartDate}
            onSelectWeek={(w) => { setSelectedWeek(w); setTab('metrics'); }}
          />
        )}
      </ScrollView>

      <WpBottomNav activeTab={tab} onTabPress={setTab} />
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },

    // Loading
    loadingRoot: {
      flex: 1,
      backgroundColor: t.bg,
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
      backgroundColor: `${ADMIN_INDIGO}20`,
      borderWidth: 1,
      borderColor: `${ADMIN_INDIGO}40`,
    },
    adminBadgeText: { fontSize: 9, fontWeight: '700', color: ADMIN_INDIGO },

    // Tab bar
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
      borderRadius: t.radius,
      backgroundColor: t.surface,
      borderWidth: 1,
    },
    metricCardLabel: { fontSize: 10, color: t.textSecondary, marginBottom: 6 },
    metricCardLabelUpper: { textTransform: 'uppercase', letterSpacing: 1 },
    metricCardValue: { fontSize: 22, fontWeight: '800' },
    metricCardUnit: { fontSize: 10, color: t.textSecondary, marginTop: 2 },
    noDataText: { fontSize: 14, color: t.textSecondary, textAlign: 'center', marginTop: 32 },

    // History
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
    historyItemStatus: { fontSize: 11, color: t.textSecondary, marginTop: 2 },
    historyBadge: {
      fontSize: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      fontWeight: '600',
      overflow: 'hidden',
    },
    historyBadgeLive: {
      backgroundColor: `${accent}15`,
      color: accent,
    },
    historyBadgeView: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      color: t.textSecondary,
    },

    // Bottom nav
    bottomNav: {
      height: 72,
      backgroundColor: t.surfaceAlt,
      borderTopWidth: 1,
      borderTopColor: t.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    navLabel: { fontSize: 10, fontWeight: '400', color: t.textSecondary },
    navLabelActive: { fontWeight: '600', color: accent },
    navItemDimmed: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      opacity: 0.4,
    },
    navLabelDimmed: { fontSize: 10, color: t.textSecondary },

    // Public
    publicHeader: {
      padding: 12,
      backgroundColor: `${accent}10`,
      borderBottomWidth: 1,
      borderBottomColor: `${accent}25`,
      alignItems: 'center',
    },
    publicHero: { padding: 20 },
    publicHeroTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary, marginBottom: 8 },
    publicHeroSub: { fontSize: 13, color: t.textSecondary, lineHeight: 21 },
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
      borderColor: `${accent}50`,
      backgroundColor: `${accent}10`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockIcon: { fontSize: 18 },
    lockText: { fontSize: 14, fontWeight: '700', color: t.textPrimary, textAlign: 'center' },

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
      backgroundColor: `${accent}10`,
      borderWidth: 1,
      borderColor: `${accent}25`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyIconText: { fontSize: 30 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
    emptySub: { fontSize: 13, color: t.textSecondary, lineHeight: 21, textAlign: 'center', maxWidth: 300 },

    // Misc
    spinner: { marginTop: 32 },
    errorText: { color: t.danger, fontSize: 13, textAlign: 'center', padding: 12 },
  });
}
