import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import type { LighthouseMatch } from './types';
import {
  fetchAdminMatches,
  fetchAdminStats,
  updateAdminMatchStatus,
  type LighthouseAdminStats,
} from './admin-api';

const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';
const SUBTLE = '#9CA3AF';

function statusColor(status: LighthouseMatch['status']): string {
  if (status === 'accepted' || status === 'completed') return '#22C55E';
  if (status === 'rejected' || status === 'cancelled') return '#EF4444';
  return '#F59E0B';
}

export const AdminLighthouse = () => {
  const { auth, loading: authLoading } = usePluginAuth('clerk');
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('lighthouse', theme);
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [stats, setStats] = useState<LighthouseAdminStats | null>(null);
  const [matches, setMatches] = useState<LighthouseMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const [statsResult, matchesResult] = await Promise.all([
      fetchAdminStats(),
      fetchAdminMatches(),
    ]);
    if (statsResult.forbidden || matchesResult.forbidden) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setForbidden(false);
    if (!statsResult.ok && statsResult.message) setError(statsResult.message);
    else if (!matchesResult.ok && matchesResult.message) setError(matchesResult.message);
    setStats(statsResult.stats);
    setMatches(matchesResult.items);
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const runUpdate = useCallback(
    async (matchId: string, status: 'accepted' | 'rejected') => {
      if (!auth?.userId) return;
      setActing(matchId);
      setError(null);
      setNotice(null);
      try {
        await updateAdminMatchStatus(matchId, status);
        setNotice(`Match ${status === 'accepted' ? 'approved' : 'rejected'}.`);
        await load();
      } catch {
        setError('Could not update the match. Try again.');
      } finally {
        setActing(null);
      }
    },
    [auth, load],
  );

  // State-changing decisions require an explicit confirm gesture.
  const confirmUpdate = useCallback(
    (match: LighthouseMatch, status: 'accepted' | 'rejected') => {
      const verb = status === 'accepted' ? 'Approve' : 'Reject';
      Alert.alert(
        `${verb} match`,
        `${verb} this housing match request?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: verb,
            style: status === 'rejected' ? 'destructive' : 'default',
            onPress: () => void runUpdate(match.id, status),
          },
        ],
      );
    },
    [runUpdate],
  );

  if (authLoading || (loading && !forbidden && error === null)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={styles.center}>
        <Text style={styles.noticeText}>The LightHouse admin tools are available to admins only.</Text>
      </View>
    );
  }

  const summary: Array<{ label: string; value: number; color: string }> = stats
    ? [
        { label: 'Seekers', value: stats.seekers, color: accent },
        { label: 'Hosts', value: stats.hosts, color: '#A78BFA' },
        { label: 'Properties', value: stats.properties, color: '#3B82F6' },
        { label: 'Active matches', value: stats.activeMatches, color: '#F59E0B' },
        { label: 'Completed matches', value: stats.completedMatches, color: '#22C55E' },
      ]
    : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>LightHouse Admin</Text>
      <Text style={styles.subtitle}>Housing match queue. Approve or reject pending matches.</Text>

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

      <Text style={styles.sectionHeading}>Matches</Text>
      {matches.length === 0 ? (
        <Text style={styles.emptyText}>No matches to moderate.</Text>
      ) : (
        matches.map((match) => (
          <React.Fragment key={match.id}>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.matchTitle}>Match {match.id.slice(0, 8)}</Text>
              <Text style={[styles.matchStatus, { color: statusColor(match.status) }]}>{match.status}</Text>
            </View>
            {match.message ? (
              <Text style={styles.matchMessage} numberOfLines={3}>
                {match.message}
              </Text>
            ) : null}
            {match.proposedMoveInDateIso ? (
              <Text style={styles.cardMeta}>Proposed move-in: {match.proposedMoveInDateIso.slice(0, 10)}</Text>
            ) : null}
            {match.status === 'pending' ? (
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionBtn, styles.acceptBtn, acting === match.id ? styles.btnBusy : null]}
                  onPress={() => confirmUpdate(match, 'accepted')}
                  disabled={acting === match.id}
                >
                  <Text style={[styles.actionText, styles.acceptText]}>Approve</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.rejectBtn, acting === match.id ? styles.btnBusy : null]}
                  onPress={() => confirmUpdate(match, 'rejected')}
                  disabled={acting === match.id}
                >
                  <Text style={[styles.actionText, styles.rejectText]}>Reject</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          </React.Fragment>
        ))
      )}
    </ScrollView>
  );
};

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 16 },
    center: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
    title: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
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
    emptyText: { fontSize: 13, color: SUBTLE },
    sectionHeading: { fontSize: 16, fontWeight: '700', color: t.textPrimary },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: {
      flexGrow: 1,
      flexBasis: '46%',
      backgroundColor: PANEL,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: t.radius,
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
      gap: 8,
    },
    cardMeta: { fontSize: 12, color: SUBTLE, lineHeight: 18 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    matchTitle: { fontSize: 14, fontWeight: '700', color: t.textPrimary },
    matchStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    matchMessage: { fontSize: 13, color: '#D1D5DB', lineHeight: 19 },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 9,
      borderWidth: 1,
    },
    acceptBtn: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' },
    rejectBtn: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
    btnBusy: { opacity: 0.6 },
    actionText: { fontSize: 13, fontWeight: '600' },
    acceptText: { color: t.success },
    rejectText: { color: t.danger },
  });
}
