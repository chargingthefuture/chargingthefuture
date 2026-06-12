import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import type { Round, Submission } from './SkillsHuntApi';
import {
  fetchAdminRounds,
  fetchAdminSubmissions,
  reviewAdminSubmission,
  type ReviewAction,
  type SubmissionStatusFilter,
} from './admin-api';

const COLOR = '#FBBF24';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

const STATUS_FILTERS: SubmissionStatusFilter[] = ['pending', 'accepted', 'rejected', 'flagged'];

function roundStatusColor(status: Round['status']): string {
  if (status === 'active') return '#22C55E';
  if (status === 'draft') return '#0EA5E9';
  return SUBTLE;
}

export const AdminSkillsHunt = () => {
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatusFilter>('pending');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const loadRounds = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const result = await fetchAdminRounds();
    if (!result.ok) {
      setForbidden(result.forbidden);
      if (!result.forbidden && result.message) setError(result.message);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setRounds(result.rounds);
    setActiveRoundId((current) => current ?? result.rounds[0]?.id ?? null);
    setLoading(false);
  }, [auth]);

  const loadSubmissions = useCallback(async () => {
    if (!auth?.userId || !activeRoundId) {
      setSubmissions([]);
      return;
    }
    setError(null);
    const result = await fetchAdminSubmissions(activeRoundId, statusFilter);
    if (!result.ok) {
      setForbidden(result.forbidden);
      if (!result.forbidden && result.message) setError(result.message);
      return;
    }
    setForbidden(false);
    setSubmissions(result.items);
  }, [auth, activeRoundId, statusFilter]);

  useEffect(() => {
    if (!authLoading) void loadRounds();
  }, [authLoading, loadRounds]);

  useEffect(() => {
    if (!authLoading) void loadSubmissions();
  }, [authLoading, loadSubmissions]);

  const runReview = useCallback(
    async (submissionId: string, action: ReviewAction, notes: string | null) => {
      if (!auth?.userId) return;
      setActing(submissionId);
      setError(null);
      setNotice(null);
      try {
        await reviewAdminSubmission(submissionId, action, notes);
        setNotice(`Submission ${action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'flagged'}.`);
        await loadSubmissions();
      } catch {
        setError('Could not record the decision. Try again.');
      } finally {
        setActing(null);
      }
    },
    [auth, loadSubmissions],
  );

  // State-changing decisions require an explicit confirm gesture.
  const confirmReview = useCallback(
    (submission: Submission, action: ReviewAction) => {
      const verb = action === 'accept' ? 'Accept' : action === 'reject' ? 'Reject' : 'Flag';
      Alert.alert(
        `${verb} submission`,
        `${verb} the nomination from ${submission.fullName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: verb,
            style: action === 'reject' ? 'destructive' : 'default',
            onPress: () => void runReview(submission.id, action, null),
          },
        ],
      );
    },
    [runReview],
  );

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
        <Text style={styles.noticeText}>The Skills Hunt admin tools are available to admins only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Skills Hunt Admin</Text>
      <Text style={styles.subtitle}>
        Pick a round, filter by status, and accept, reject, or flag each nomination.
      </Text>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rounds</Text>
        {rounds.length === 0 ? (
          <Text style={styles.cardMeta}>No rounds yet. Create one on the web admin before moderating.</Text>
        ) : (
          <View style={styles.pillWrap}>
            {rounds.map((round) => {
              const active = round.id === activeRoundId;
              return (
                <Pressable
                  key={round.id}
                  style={[styles.pill, active ? styles.pillActive : null]}
                  onPress={() => setActiveRoundId(round.id)}
                >
                  <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{round.name}</Text>
                  <Text style={[styles.pillStatus, { color: roundStatusColor(round.status) }]}>{round.status}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status filter</Text>
        <View style={styles.pillWrap}>
          {STATUS_FILTERS.map((status) => {
            const active = status === statusFilter;
            return (
              <Pressable
                key={status}
                style={[styles.pill, active ? styles.pillActive : null]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{status}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {submissions.length === 0 ? (
        <Text style={styles.emptyText}>No submissions matching this filter.</Text>
      ) : (
        submissions.map((submission) => (
          <React.Fragment key={submission.id}>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.submissionName}>{submission.fullName}</Text>
              <Text style={styles.submissionStatus}>{submission.status}</Text>
            </View>
            <Text style={styles.submissionBio} numberOfLines={3}>
              {submission.bio}
            </Text>
            {submission.skills.length > 0 ? (
              <Text style={styles.cardMeta}>Skills: {submission.skills.join(', ')}</Text>
            ) : null}
            {submission.status === 'pending' ? (
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionBtn, styles.acceptBtn, acting === submission.id ? styles.btnBusy : null]}
                  onPress={() => confirmReview(submission, 'accept')}
                  disabled={acting === submission.id}
                >
                  <Text style={[styles.actionText, styles.acceptText]}>Accept</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.rejectBtn, acting === submission.id ? styles.btnBusy : null]}
                  onPress={() => confirmReview(submission, 'reject')}
                  disabled={acting === submission.id}
                >
                  <Text style={[styles.actionText, styles.rejectText]}>Reject</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.flagBtn, acting === submission.id ? styles.btnBusy : null]}
                  onPress={() => confirmReview(submission, 'flag')}
                  disabled={acting === submission.id}
                >
                  <Text style={[styles.actionText, styles.flagText]}>Flag</Text>
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
  emptyText: { fontSize: 13, color: SUBTLE },
  card: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  cardMeta: { fontSize: 12, color: SUBTLE, lineHeight: 18 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pillActive: { backgroundColor: COLOR, borderColor: COLOR },
  pillText: { fontSize: 12, fontWeight: '600', color: '#D1D5DB', textTransform: 'capitalize' },
  pillTextActive: { color: '#000' },
  pillStatus: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submissionName: { fontSize: 14, fontWeight: '700', color: TEXT, flex: 1, paddingRight: 8 },
  submissionStatus: { fontSize: 11, fontWeight: '700', color: SUBTLE, textTransform: 'capitalize' },
  submissionBio: { fontSize: 13, color: '#D1D5DB', lineHeight: 19 },
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
  flagBtn: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' },
  btnBusy: { opacity: 0.6 },
  actionText: { fontSize: 13, fontWeight: '600' },
  acceptText: { color: '#22C55E' },
  rejectText: { color: '#EF4444' },
  flagText: { color: '#F59E0B' },
});
