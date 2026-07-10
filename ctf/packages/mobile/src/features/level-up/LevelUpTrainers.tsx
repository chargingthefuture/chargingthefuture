// LevelUp Trainers directory (mobile) — layout aligned to
// design/.../survivor-hub/MobileLevelUpTrainers.tsx. Real data only:
// every value comes from GET /api/level-up/trainers. The mockup also shows a
// per-trainer rating, a cohort name with status, milestones validated, a
// "message" action, and a recent-activity feed; the trainers endpoint returns
// none of those, so they are intentionally not rendered (no fabricated numbers).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { fetchTrainers, type Trainer } from './api';

const TEXT = '#E2E8F0';
const SUBTLE = '#94A3B8';

const TRACK_COLORS: Record<string, string> = {
  Tech: '#3B82F6',
  Finance: '#F59E0B',
  Wellness: '#14B8A6',
  'Life Skills': '#A855F7',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function TrainerCard({ trainer, s, accent }: { trainer: Trainer; s: ReturnType<typeof makeStyles>; accent: string }) {
  const primaryTrack = trainer.tracks[0];
  const tc = (primaryTrack && TRACK_COLORS[primaryTrack]) || accent;
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.avatar, { backgroundColor: `${tc}18`, borderColor: `${tc}40` }]}>
          <Text style={[s.avatarText, { color: tc }]}>{initials(trainer.displayName)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.nameRow}>
            <Text style={s.name}>{trainer.displayName}</Text>
            {trainer.tracks.map((track) => {
              const color = TRACK_COLORS[track] ?? accent;
              return (
                <React.Fragment key={track}>
                  <View style={[s.trackBadge, { backgroundColor: `${color}15` }]}>
                    <Text style={[s.trackBadgeText, { color }]}>{track}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
          {trainer.headline ? <Text style={s.headline}>{trainer.headline}</Text> : null}
        </View>
      </View>
      {trainer.bio ? (
        <View style={s.bioBox}>
          <Text style={s.bio}>{trainer.bio}</Text>
        </View>
      ) : null}
      <Text style={s.cohortCount}>
        {trainer.activeCohortCount} active {trainer.activeCohortCount === 1 ? 'cohort' : 'cohorts'}
      </Text>
    </View>
  );
}

export function LevelUpTrainers() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('level-up', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrainers(await fetchTrainers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trainers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <ActivityIndicator color={accent} style={{ marginTop: 32 }} />;
  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => void load()}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (trainers.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>No trainers listed yet</Text>
        <Text style={s.emptyBody}>Trainers are survivor-advocates who lead cohorts.</Text>
      </View>
    );
  }

  const trackSet = new Set<string>();
  trainers.forEach((t) => t.tracks.forEach((track) => trackSet.add(track)));
  const totalCohorts = trainers.reduce((sum, t) => sum + t.activeCohortCount, 0);

  return (
    <FlatList
      data={trainers}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TrainerCard trainer={item} s={s} accent={accent} />}
      contentContainerStyle={s.list}
      ListHeaderComponent={
        <View style={s.statsRow}>
          {[
            { label: 'Trainers', value: String(trainers.length), color: accent },
            { label: 'Tracks', value: String(trackSet.size), color: '#3B82F6' },
            { label: 'Cohorts', value: String(totalCohorts), color: '#F59E0B' },
          ].map(({ label, value, color }) => (
            <React.Fragment key={label}>
              <View style={s.statCard}>
                <Text style={[s.statValue, { color }]}>{value}</Text>
                <Text style={s.statLabel}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      }
    />
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    list: { padding: 16, paddingBottom: 80 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: t.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: t.border, alignItems: 'center' },
    statValue: { fontSize: 16, fontWeight: '700' },
    statLabel: { fontSize: 10, color: SUBTLE, marginTop: 2 },
    card: { backgroundColor: t.surface, borderRadius: t.radius, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.border },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatar: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontWeight: '700', fontSize: 13 },
    nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
    name: { fontSize: 14, fontWeight: '700', color: TEXT },
    headline: { fontSize: 12, color: SUBTLE },
    bioBox: { backgroundColor: t.bg, borderRadius: 7, borderWidth: 1, borderColor: t.border, padding: 10, marginBottom: 10 },
    bio: { fontSize: 12, color: SUBTLE, lineHeight: 18 },
    trackBadge: { borderRadius: t.radius, paddingHorizontal: 7, paddingVertical: 2 },
    trackBadgeText: { fontSize: 10, fontWeight: '600' },
    cohortCount: { fontSize: 12, color: t.textMuted },
    errorText: { fontSize: 14, color: t.danger, textAlign: 'center', marginBottom: 16 },
    retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 9, backgroundColor: accent },
    retryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6 },
    emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 20 },
  });
}
