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
import { fetchGdpCurrentReport, pickMetric, pickMetricIsEstimate, GdpReport } from './api';

// Shared estimate copy — mirrors the web GDP shell (gdp-shared.ts) so the legal
// wording stays identical: a community-wide normalized USD estimate, never a
// per-user redemption value.
const GDP_ESTIMATE_CHIP_LABEL = 'Estimate';
const GDP_ESTIMATE_FOOTNOTE =
  '* USD estimate normalized across currencies — a transparency metric, not a ledger.';

// ─── Design tokens (from MobileGDP.tsx design-sync) ──────────────────────────
const COLOR = '#06B6D4';
const BG = '#0F1117';
const BG_DARK = '#090B0F';
const TEXT_PRIMARY = '#F9FAFB';
const TEXT_BODY = '#E8EAF0';
const TEXT_MUTED = '#9CA3AF';
const TEXT_DIM = '#6B7280';
const BORDER = 'rgba(255,255,255,0.06)';

// ─── Nav tabs (from mockup) ───────────────────────────────────────────────────
const NAV = [
  { label: 'Home', key: 'home' },
  { label: 'Overview', key: 'overview' },
  { label: 'Sectors', key: 'sectors' },
  { label: 'Trend', key: 'trend' },
] as const;

type NavKey = (typeof NAV)[number]['key'];

// ─── Loading state (from MobileGDPLoading.tsx) ───────────────────────────────
function GdpLoadingState() {
  return (
    <View style={styles.root}>
      <View style={styles.loadingCenter}>
        <Text style={styles.loadingTagline}>EXIT THEIR ECONOMY</Text>
        <Text style={styles.loadingTagline}>EXIT THE PSYOP</Text>
        <ActivityIndicator color={COLOR} size="large" style={styles.loadingSpinner} />
      </View>
    </View>
  );
}

// ─── Public (unauthenticated) state (from MobileGDPPublic.tsx) ───────────────
function GdpPublicState({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View style={styles.root}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusIcons}>●●●</Text>
      </View>
      <ScrollView contentContainerStyle={styles.publicContent}>
        <View style={styles.publicHeadingRow}>
          <Text style={styles.publicTitle}>GDP</Text>
        </View>
        <View style={styles.publicBadge}>
          <Text style={styles.publicBadgeText}>Survivor economy dashboard</Text>
        </View>
        <Text style={styles.publicDesc}>
          The gross domestic product of the survivor economy — real-time economic activity, skill
          gaps, and contributor rankings.
        </Text>
        {/* Live snapshot — platform economic activity aggregate is a real metric */}
        <View style={styles.publicSnapshotCard}>
          <Text style={styles.publicSnapshotLabel}>Platform economic activity</Text>
          <Text style={styles.publicSnapshotValue}>Loading…</Text>
          <Text style={styles.publicSnapshotSub}>Sign in to view live figures</Text>
        </View>
        <TouchableOpacity style={styles.publicCta} onPress={onSignIn}>
          <Text style={styles.publicCtaText}>Join the Hub — Free</Text>
        </TouchableOpacity>
        <View style={styles.publicLockedArea}>
          <View style={styles.publicLockIcon}>
            <Text style={styles.publicLockIconText}>🔒</Text>
          </View>
          <Text style={styles.publicLockTitle}>Sign in for contributor rankings</Text>
          <TouchableOpacity style={styles.publicSignInBtn} onPress={onSignIn}>
            <Text style={styles.publicSignInBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Empty state (no published report) (from MobileGDPEmpty.tsx) ─────────────
function GdpEmptyState({ onAddSkills }: { onAddSkills?: () => void }) {
  return (
    <View style={styles.root}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusIcons}>●●●</Text>
      </View>
      <View style={styles.emptyHeader}>
        <Text style={styles.emptyHeaderTitle}>GDP Dashboard</Text>
      </View>
      <View style={styles.emptyContent}>
        {/* Big stat — static design label; no fabricated figure */}
        <View style={styles.emptyStatCard}>
          <Text style={styles.emptyStatLabel}>TI Skills Economy</Text>
          {/* GDP total revenue omitted — no published data */}
          <Text style={styles.emptyStatValue}>—</Text>
          <Text style={styles.emptyStatSub}>No published report yet</Text>
        </View>
        {/* Contribution call-to-action */}
        <View style={styles.emptyCtaCard}>
          <Text style={styles.emptyCtaIcon}>📈</Text>
          <Text style={styles.emptyCtaTitle}>Your contribution: $0</Text>
          <Text style={styles.emptyCtaDesc}>
            Add your verified skills to contribute to the collective economy and appear on the global
            map.
          </Text>
          {onAddSkills && (
            <TouchableOpacity style={styles.emptyCtaBtn} onPress={onAddSkills}>
              <Text style={styles.emptyCtaBtnText}>+ Add Your Skills</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Main authenticated view ──────────────────────────────────────────────────
function GdpMainView({ report }: { report: GdpReport }) {
  const [activeNav, setActiveNav] = useState<NavKey>('overview');

  // Real metric bindings — keys observed in web repository.ts getGdpShellStats()
  const totalRevenue = pickMetric(report.metrics, 'gdp_total_revenue');
  const weeklyActiveUsers = pickMetric(report.metrics, 'weekly_active_users');
  // The headline GDP figure shows the estimate treatment only when the published
  // data flags it a normalized USD estimate.
  const totalRevenueIsEstimate = pickMetricIsEstimate(report.metrics, 'gdp_total_revenue');

  // Format helpers
  function fmtUsd(n: number | null): string {
    if (n === null) return '—';
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
  }

  function fmtCount(n: number | null): string {
    if (n === null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  return (
    <View style={styles.root}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusIcons}>100%</Text>
      </View>

      {/* App header */}
      <View style={styles.appHeader}>
        <View style={styles.appHeaderLeft}>
          <View style={styles.appHeaderIcon}>
            <Text style={styles.appHeaderIconText}>🌐</Text>
          </View>
          <View>
            <Text style={styles.appHeaderTitle}>GDP Tracker</Text>
            <Text style={styles.appHeaderSub}>TI Skills Economy · Live</Text>
          </View>
        </View>
        <View style={styles.liveChip}>
          <Text style={styles.liveChipText}>↑ Live</Text>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPad}>
        {activeNav === 'overview' && (
          <GdpOverviewTab
            totalRevenue={totalRevenue}
            totalRevenueIsEstimate={totalRevenueIsEstimate}
            weeklyActiveUsers={weeklyActiveUsers}
            fmtUsd={fmtUsd}
            fmtCount={fmtCount}
            publication={report.publication}
          />
        )}
        {activeNav === 'sectors' && (
          <GdpSectorsTab />
        )}
        {activeNav === 'trend' && (
          <GdpTrendTab totalRevenue={totalRevenue} fmtUsd={fmtUsd} />
        )}
        {activeNav === 'home' && (
          <GdpHomeTab />
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {NAV.map(({ label, key }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setActiveNav(key)}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <View style={[styles.navIconWrap, activeNav === key && styles.navIconActive]}>
              <Text style={styles.navIcon}>{navIcon(key)}</Text>
            </View>
            <Text style={[styles.navLabel, activeNav === key && styles.navLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function navIcon(key: NavKey): string {
  if (key === 'home') return '🏠';
  if (key === 'overview') return '🌐';
  if (key === 'sectors') return '📊';
  return '📈';
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function GdpOverviewTab({
  totalRevenue,
  totalRevenueIsEstimate,
  weeklyActiveUsers,
  fmtUsd,
  fmtCount,
  publication,
}: {
  totalRevenue: number | null;
  totalRevenueIsEstimate: boolean;
  weeklyActiveUsers: number | null;
  fmtUsd: (_n: number | null) => string;
  fmtCount: (_n: number | null) => string;
  publication: GdpReport['publication'];
}) {
  return (
    <>
      {/* Hero card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>TI SKILLS ECONOMY</Text>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValue}>{fmtUsd(totalRevenue)}</Text>
          {totalRevenueIsEstimate && (
            <View style={styles.estimateChip}>
              <Text style={styles.estimateChipText}>{GDP_ESTIMATE_CHIP_LABEL}</Text>
            </View>
          )}
        </View>
        <Text style={styles.heroSub}>{publication.title}</Text>
        {/* Progress bar omitted — $300B target figure has no API backing field */}
        {totalRevenueIsEstimate && (
          <Text style={styles.estimateFootnote}>{GDP_ESTIMATE_FOOTNOTE}</Text>
        )}
      </View>

      {/* Stat chips */}
      <View style={styles.statRow}>
        <View style={[styles.statChip, { borderColor: '#A78BFA20', backgroundColor: '#A78BFA08' }]}>
          <Text style={[styles.statChipValue, { color: '#A78BFA' }]}>{fmtCount(weeklyActiveUsers)}</Text>
          <Text style={styles.statChipLabel}>Active users</Text>
        </View>
        {/*
          Countries (127) and "This week" (+$1.2B) figures are not backed
          by a real API metric key — omitted per real-data-only rule.
        */}
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Report Summary</Text>
        <Text style={styles.summaryText}>{publication.summary}</Text>
        <Text style={styles.summaryDate}>Week of {publication.weekStartDate}</Text>
      </View>

      {/*
        Top Countries and personal contribution cards are omitted —
        country-level breakdown and per-user contribution are not
        returned by /api/gdp/report/current.
      */}
    </>
  );
}

// ─── Sectors tab ─────────────────────────────────────────────────────────────
function GdpSectorsTab() {
  /*
   * Sector breakdown (Professional Services, Technology & Coding, etc.) is not
   * returned by /api/gdp/report/current — no metric keys map to sector splits.
   * Omitted per real-data-only rule; honest empty state shown instead.
   */
  return (
    <View style={styles.sectorEmpty}>
      <Text style={styles.sectorEmptyIcon}>📊</Text>
      <Text style={styles.sectorEmptyTitle}>GDP by Sector</Text>
      <Text style={styles.sectorEmptyDesc}>
        Sector breakdown data is not yet available in the published report.
      </Text>
    </View>
  );
}

// ─── Trend tab ────────────────────────────────────────────────────────────────
function GdpTrendTab({
  totalRevenue,
  fmtUsd,
}: {
  totalRevenue: number | null;
  fmtUsd: (_n: number | null) => string;
}) {
  /*
   * Weekly series data (M/T/W/T/F/S/S bar chart) is not returned by
   * /api/gdp/report/current — omitted per real-data-only rule.
   * Only the current total is shown.
   */
  return (
    <>
      <Text style={styles.trendTitle}>Weekly Growth</Text>
      <View style={styles.trendCard}>
        <Text style={styles.trendLabel}>Current total (latest published report)</Text>
        <Text style={styles.trendValue}>{fmtUsd(totalRevenue)}</Text>
        <Text style={styles.trendNote}>
          Weekly trend series is not yet available in the current report.
        </Text>
      </View>
      {/*
        $300B Target Timeline progress bar omitted —
        target figure has no API backing field.
      */}
    </>
  );
}

// ─── Home tab ─────────────────────────────────────────────────────────────────
function GdpHomeTab() {
  return (
    <View style={styles.homeTab}>
      <Text style={styles.homeIcon}>🗺️</Text>
      <Text style={styles.homeTitle}>TI Skills Economy</Text>
      <Text style={styles.homeDesc}>Building a survivor economy — one skill at a time.</Text>
    </View>
  );
}

// ─── Root screen ──────────────────────────────────────────────────────────────
export const Gdp = () => {
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  const [report, setReport] = useState<GdpReport | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setDataLoading(true);
    setFetchError(null);
    fetchGdpCurrentReport()
      .then((r) => {
        if (!cancelled) {
          setReport(r);
          setDataLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError('Unable to load GDP data. Please try again.');
          setDataLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (authLoading) {
    return <GdpLoadingState />;
  }

  if (!isAuthenticated) {
    return <GdpPublicState onSignIn={signIn} />;
  }

  if (dataLoading) {
    return <GdpLoadingState />;
  }

  if (fetchError) {
    return (
      <View style={styles.root}>
        <View style={styles.errorCenter}>
          <Text style={styles.errorText}>{fetchError}</Text>
        </View>
      </View>
    );
  }

  if (!report) {
    return <GdpEmptyState />;
  }

  return <GdpMainView report={report} />;
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  // Loading
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingTagline: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  loadingSpinner: {
    marginTop: 24,
  },
  // Status bar
  statusBar: {
    height: 44,
    backgroundColor: BG_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  statusTime: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  statusIcons: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  // App header
  appHeader: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: BG_DARK,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appHeaderIconText: {
    fontSize: 18,
  },
  appHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  appHeaderSub: {
    fontSize: 11,
    color: COLOR,
  },
  liveChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: '#22C55E20',
    borderWidth: 1,
    borderColor: '#22C55E35',
  },
  liveChipText: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '600',
  },
  // Content
  content: {
    flex: 1,
  },
  contentPad: {
    padding: 16,
    paddingBottom: 24,
  },
  // Hero card
  heroCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: `${COLOR}12`,
    borderWidth: 1,
    borderColor: `${COLOR}25`,
    marginBottom: 16,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 42,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    lineHeight: 48,
  },
  estimateChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  estimateChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_DIM,
    letterSpacing: 0.4,
  },
  estimateFootnote: {
    fontSize: 10.5,
    color: '#4B5563',
    marginTop: 10,
    lineHeight: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  // Stat chips
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statChip: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statChipValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statChipLabel: {
    fontSize: 10,
    color: TEXT_DIM,
  },
  // Summary card
  summaryCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: TEXT_BODY,
    lineHeight: 20,
    marginBottom: 8,
  },
  summaryDate: {
    fontSize: 12,
    color: TEXT_DIM,
  },
  // Sectors empty
  sectorEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  sectorEmptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  sectorEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  sectorEmptyDesc: {
    fontSize: 13,
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Trend
  trendTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  trendCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  trendLabel: {
    fontSize: 12,
    color: TEXT_DIM,
    marginBottom: 6,
  },
  trendValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLOR,
    marginBottom: 8,
  },
  trendNote: {
    fontSize: 12,
    color: TEXT_DIM,
    lineHeight: 18,
  },
  // Home tab
  homeTab: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  homeIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  homeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 6,
    textAlign: 'center',
  },
  homeDesc: {
    fontSize: 13,
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Bottom nav
  bottomNav: {
    height: 72,
    backgroundColor: BG_DARK,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: `${COLOR}20`,
  },
  navIcon: {
    fontSize: 18,
  },
  navLabel: {
    fontSize: 10,
    color: TEXT_DIM,
    fontWeight: '400',
    marginTop: 2,
  },
  navLabelActive: {
    color: COLOR,
    fontWeight: '600',
  },
  // Public state
  publicContent: {
    padding: 20,
    paddingBottom: 32,
  },
  publicHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  publicTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  publicBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    marginBottom: 10,
  },
  publicBadgeText: {
    fontSize: 11,
    color: COLOR,
    fontWeight: '600',
  },
  publicDesc: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 22,
    marginBottom: 16,
  },
  publicSnapshotCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    backgroundColor: `${COLOR}06`,
    padding: 18,
    marginBottom: 16,
  },
  publicSnapshotLabel: {
    fontSize: 11,
    color: TEXT_DIM,
    marginBottom: 6,
  },
  publicSnapshotValue: {
    fontSize: 26,
    fontWeight: '900',
    color: COLOR,
    marginBottom: 4,
  },
  publicSnapshotSub: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  publicCta: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLOR,
    alignItems: 'center',
    marginBottom: 24,
  },
  publicCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  publicLockedArea: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  publicLockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: `${COLOR}50`,
    backgroundColor: `${COLOR}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publicLockIconText: {
    fontSize: 20,
  },
  publicLockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  publicSignInBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 9,
    backgroundColor: COLOR,
  },
  publicSignInBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  // Empty state
  emptyHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  emptyContent: {
    flex: 1,
    padding: 20,
  },
  emptyStatCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLOR}25`,
    backgroundColor: `${COLOR}08`,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStatLabel: {
    fontSize: 11,
    color: TEXT_DIM,
    marginBottom: 6,
  },
  emptyStatValue: {
    fontSize: 42,
    fontWeight: '900',
    color: COLOR,
    marginBottom: 4,
  },
  emptyStatSub: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  emptyCtaCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    borderStyle: 'dashed',
    backgroundColor: '#161B27',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  emptyCtaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  emptyCtaDesc: {
    fontSize: 13,
    color: TEXT_DIM,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyCtaBtn: {
    width: '100%',
    padding: 13,
    borderRadius: 12,
    backgroundColor: COLOR,
    alignItems: 'center',
  },
  emptyCtaBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  // Error
  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
});
