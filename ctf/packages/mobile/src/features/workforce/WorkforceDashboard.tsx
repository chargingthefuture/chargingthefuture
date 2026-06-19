import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { WorkforceLoading } from './WorkforceLoading';
import { WorkforceEmpty } from './WorkforceEmpty';
import { WorkforceStatCard } from './WorkforceStatCard';
import { WorkforceProfileCard } from './WorkforceProfileCard';
import { fetchWorkforceDashboard, fetchWorkforceProfile } from './api';
import type { WorkforceDashboardData, WorkforceProfileData } from './api';

// Design: MobileWorkforce — main authenticated dashboard
// Binds to GET /api/workforce/dashboard and GET /api/workforce/profile (real routes only)
// Omitted from mockup (no API backing): Status Distribution bars, Critical Skill Gaps, Recommended Pathways
const COLOR = '#F97316';

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function DashboardHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerIconWrap}>
        <Text style={styles.headerIconText}>≡</Text>
      </View>
      <View>
        <Text style={styles.headerTitle}>Workforce</Text>
        <Text style={styles.headerSubtitle}>Live workforce data</Text>
      </View>
    </View>
  );
}

interface StatGridProps {
  dashboard: WorkforceDashboardData;
}

function StatGrid({ dashboard }: StatGridProps) {
  // API: dashboard.workforceTotal, dashboard.recruitedTotal,
  //      dashboard.occupationsTotal
  const stats = [
    { label: 'Total Members', value: formatCount(dashboard.workforceTotal), color: COLOR },
    { label: 'Recruited', value: formatCount(dashboard.recruitedTotal), color: '#22C55E' },
    { label: 'Occupations', value: formatCount(dashboard.occupationsTotal), color: '#F59E0B' },
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

export function WorkforceDashboard() {
  const [dashboard, setDashboard] = useState<WorkforceDashboardData | null>(null);
  const [profile, setProfile] = useState<WorkforceProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchWorkforceDashboard(), fetchWorkforceProfile()])
      .then(([dash, prof]) => {
        if (!active) return;
        setDashboard(dash);
        setProfile(prof);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load workforce data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  if (loading) {
    return <WorkforceLoading />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!dashboard || dashboard.workforceTotal === 0) {
    return <WorkforceEmpty />;
  }

  return (
    <View style={styles.container}>
      <DashboardHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatGrid dashboard={dashboard} />

        {/* Status Distribution bars — no real pct breakdown in API → omitted */}
        {/* Critical Skill Gaps — no gap data in API → omitted */}

        {profile ? (
          <WorkforceProfileCard profile={profile} />
        ) : (
          <View style={styles.noProfileCard}>
            <Text style={styles.noProfileText}>
              No workforce profile yet. Complete your profile to get matched to opportunities.
            </Text>
          </View>
        )}

        {/* Recommended Pathways — no pathway match data in API → omitted */}
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
