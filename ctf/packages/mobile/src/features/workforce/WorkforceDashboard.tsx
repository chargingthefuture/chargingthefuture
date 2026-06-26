import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import { WorkforceLoading } from './WorkforceLoading';
import { WorkforceEmpty } from './WorkforceEmpty';
import { WorkforcePublic } from './WorkforcePublic';
import { WorkforceStatCard } from './WorkforceStatCard';
import { WorkforceProfileCard } from './WorkforceProfileCard';
import {
  fetchWorkforceDashboard,
  fetchWorkforceProfile,
  fetchWorkforceSectorReport,
  fetchWorkforceOccupationGaps,
} from './api';
import type {
  WorkforceDashboardData,
  WorkforceGroupedReportItem,
  WorkforceOccupationGapItem,
  WorkforceProfileData,
} from './api';

// Live workforce tracker: demand from Skills Taxonomy (population-scaled) vs supply from Directory.
const COLOR = '#F97316';

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function DashboardHeader({ subtitle }: { subtitle: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIconWrap}>
        <Text style={styles.headerIconText}>≡</Text>
      </View>
      <View>
        <Text style={styles.headerTitle}>Workforce</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function StatGrid({ dashboard }: { dashboard: WorkforceDashboardData }) {
  const stats = [
    { label: 'Population', value: formatCount(dashboard.population), color: '#6366F1' },
    { label: 'Workforce Total', value: formatCount(dashboard.workforceTotal), color: COLOR },
    { label: 'Headcount Target', value: formatCount(dashboard.totalHeadcountTarget), color: '#EF4444' },
    { label: 'Recruited', value: formatCount(dashboard.recruitedTotal), color: '#22C55E' },
    { label: 'Directory Members', value: formatCount(dashboard.totalMembers), color: '#F59E0B' },
  ];

  return (
    <View style={styles.statGrid}>
      {stats.map((s) => (
        <React.Fragment key={s.label}>
          <WorkforceStatCard label={s.label} value={s.value} color={s.color} />
        </React.Fragment>
      ))}
    </View>
  );
}

function SectorGaps({ items }: { items: WorkforceGroupedReportItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Sector Gaps</Text>
      {items.map((g) => (
        <View key={g.bucket} style={styles.row}>
          <Text style={styles.rowLabel} numberOfLines={1}>{g.bucket}</Text>
          <Text style={styles.rowMeta}>{formatCount(g.recruited)} / {formatCount(g.target)}</Text>
          <Text style={styles.rowGap}>{g.gap > 0 ? `–${formatCount(g.gap)}` : '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function TrainingGaps({ items }: { items: WorkforceOccupationGapItem[] }) {
  const gaps = items.filter((o) => o.gap > 0);
  if (gaps.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Top Training Gaps</Text>
      {gaps.map((o) => (
        <View key={o.jobTitleId} style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowLabel} numberOfLines={1}>{o.occupation}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>{o.sector} · {o.skillLevel}</Text>
          </View>
          <Text style={styles.rowGap}>Gap {formatCount(o.gap)}</Text>
        </View>
      ))}
    </View>
  );
}

export function WorkforceDashboard() {
  const { auth, loading: authLoading } = usePluginAuth('clerk');
  const isAuthenticated = auth?.isAuthenticated ?? false;

  const [dashboard, setDashboard] = useState<WorkforceDashboardData | null>(null);
  const [profile, setProfile] = useState<WorkforceProfileData | null>(null);
  const [sectors, setSectors] = useState<WorkforceGroupedReportItem[]>([]);
  const [occupations, setOccupations] = useState<WorkforceOccupationGapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't hit the member-scoped endpoints until auth resolves and the user is signed in — an
    // unauthenticated dashboard otherwise fires four 401s and shows a misleading "no profile" state.
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchWorkforceDashboard(),
      fetchWorkforceProfile(),
      fetchWorkforceSectorReport(),
      fetchWorkforceOccupationGaps(10),
    ])
      .then(([dash, prof, sect, occ]) => {
        if (!active) return;
        setDashboard(dash);
        setProfile(prof);
        setSectors(sect);
        setOccupations(occ);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load workforce data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [authLoading, isAuthenticated]);

  if (authLoading || (isAuthenticated && loading)) {
    return <WorkforceLoading />;
  }

  if (!isAuthenticated) {
    return <WorkforcePublic />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Empty only when there is genuinely nothing to track: no taxonomy and nobody in the Directory.
  if (
    !dashboard
    || (dashboard.sectorsTotal === 0 && dashboard.occupationsTotal === 0 && dashboard.totalMembers === 0)
  ) {
    return <WorkforceEmpty />;
  }

  const subtitle = `${formatCount(dashboard.totalMembers)} members · ${formatCount(dashboard.recruitedTotal)} recruited`;

  return (
    <View style={styles.container}>
      <DashboardHeader subtitle={subtitle} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatGrid dashboard={dashboard} />
        <SectorGaps items={sectors} />
        <TrainingGaps items={occupations} />

        {profile ? (
          <WorkforceProfileCard profile={profile} />
        ) : (
          <View style={styles.noProfileCard}>
            <Text style={styles.noProfileText}>
              No workforce profile yet. Complete your profile to get matched to opportunities.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0F1117',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#090B0F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLOR + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 16,
    color: COLOR,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLOR,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  rowLabelWrap: {
    flex: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    color: '#E8EAF0',
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 11,
    color: '#6B7280',
  },
  rowMeta: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  rowGap: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 70,
  },
  noProfileCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  noProfileText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
});
