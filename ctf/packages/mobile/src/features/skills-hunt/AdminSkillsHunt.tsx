import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import type { Round, Submission } from './SkillsHuntApi';
import {
  fetchAdminRounds,
  fetchAdminSubmissions,
  rebuildRoundLeaderboard,
  removeAdminSubmission,
  reviewAdminSubmission,
  type ReviewAction,
  type RoundRewardSummary,
  type SubmissionStatusFilter,
} from './admin-api';

// Always render ServiceCredits in full words (never the bare "SC" code, never a fiat equivalent).
function creditsLabel(amount: number): string {
  return `${amount} ServiceCredits`;
}

// Left raw (no exact theme-token match): the shared admin panel/border/subtle greys.
const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';
const SUBTLE = '#9CA3AF';

const STATUS_FILTERS: SubmissionStatusFilter[] = ['pending', 'accepted', 'rejected', 'flagged'];

// Round status palette — deliberately raw (status colors stay together, untokenized).
function roundStatusColor(status: Round['status']): string {
  if (status === 'active') return '#22C55E';
  if (status === 'draft') return '#0EA5E9';
  return SUBTLE;
}

export const AdminSkillsHunt = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('skills-hunt', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatusFilter>('pending');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [roundDetail, setRoundDetail] = useState<Round | null>(null);
  const [rewardSummary, setRewardSummary] = useState<RoundRewardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

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
    setRoundDetail(result.round);
    setRewardSummary(result.rewardSummary);
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

  // Soft-delete a submission. Unlike Reject, it does not count as a scout
  // rejection — use it to void a duplicate, spam, or test row.
  const runRemove = useCallback(
    async (submissionId: string) => {
      if (!auth?.userId) return;
      setActing(submissionId);
      setError(null);
      setNotice(null);
      try {
        await removeAdminSubmission(submissionId);
        setNotice('Submission removed. It no longer counts toward the leaderboard or the scout.');
        await loadSubmissions();
      } catch {
        setError('Could not remove the submission. Try again.');
      } finally {
        setActing(null);
      }
    },
    [auth, loadSubmissions],
  );

  const confirmRemove = useCallback(
    (submission: Submission) => {
      Alert.alert(
        'Remove submission',
        `Remove the nomination from ${submission.fullName}? It stops counting toward the leaderboard and does not register as a rejection for the scout. This does not reverse any ServiceCredits already paid.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => void runRemove(submission.id) },
        ],
      );
    },
    [runRemove],
  );

  // Manual leaderboard rebuild for the selected round.
  const runRebuild = useCallback(async () => {
    if (!auth?.userId || !activeRoundId) return;
    setRebuilding(true);
    setError(null);
    setNotice(null);
    try {
      await rebuildRoundLeaderboard(activeRoundId);
      setNotice('Leaderboard rebuilt from the current accepted nominations.');
    } catch {
      setError('Could not rebuild the leaderboard. Try again.');
    } finally {
      setRebuilding(false);
    }
  }, [auth, activeRoundId]);

  const confirmRebuild = useCallback(() => {
    Alert.alert(
      'Rebuild leaderboard',
      'Recompute this round’s individual and team boards from the current accepted nominations?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rebuild', style: 'default', onPress: () => void runRebuild() },
      ],
    );
  }, [runRebuild]);

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
        <Text style={styles.noticeText}>The SkillsHunt admin tools are available to admins only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SkillsHunt Admin</Text>
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

      {roundDetail ? (
        <View style={styles.rewardCard}>
          <Text style={styles.rewardTitle}>Reward</Text>
          {(roundDetail.rewardCreditsPerAccept ?? 0) > 0 ? (
            <>
              <Text style={styles.rewardLine}>
                {creditsLabel(roundDetail.rewardCreditsPerAccept ?? 0)} per accepted nomination
                {roundDetail.rewardPerUserRoundCap != null
                  ? ` · cap ${creditsLabel(roundDetail.rewardPerUserRoundCap)} per scout`
                  : ''}
              </Text>
              {rewardSummary ? (
                <Text style={styles.rewardMeta}>
                  Paid so far: {creditsLabel(rewardSummary.totalCreditsPaid)} across{' '}
                  {rewardSummary.rewardedSubmissionCount}{' '}
                  {rewardSummary.rewardedSubmissionCount === 1 ? 'nomination' : 'nominations'}
                </Text>
              ) : null}
              <Text style={styles.rewardNote}>
                The scout is paid from the treasury when you accept — minting is automatic and
                idempotent.
              </Text>
            </>
          ) : (
            <Text style={styles.rewardMeta}>
              This round pays no reward. Set an amount on the web admin to pay scouts on accept.
            </Text>
          )}
        </View>
      ) : null}

      {activeRoundId ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Leaderboard</Text>
          <Text style={styles.cardMeta}>
            Recompute this round’s individual and team boards from the current accepted nominations.
            Use it after an out-of-band data fix — the board otherwise only refreshes when you review a
            nomination.
          </Text>
          <Pressable
            style={[styles.rebuildBtn, rebuilding ? styles.btnBusy : null]}
            onPress={confirmRebuild}
            disabled={rebuilding}
          >
            {rebuilding ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Text style={styles.rebuildText}>Rebuild leaderboard</Text>
            )}
          </Pressable>
        </View>
      ) : null}

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
            {submission.creditGranted ? (
              <View style={styles.paidPill}>
                <Text style={styles.paidPillText}>✓ Paid {creditsLabel(submission.creditAmount ?? 0)}</Text>
              </View>
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
            <Pressable
              style={[styles.removeBtn, acting === submission.id ? styles.btnBusy : null]}
              onPress={() => confirmRemove(submission)}
              disabled={acting === submission.id}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
          </React.Fragment>
        ))
      )}
    </ScrollView>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
  subtitle: { fontSize: 13, color: t.textSecondary, lineHeight: 19 },
  noticeText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' },
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
  emptyText: { fontSize: 13, color: t.textSecondary },
  card: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: t.textPrimary },
  cardMeta: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
  rewardCard: {
    backgroundColor: `${accent}10`,
    borderWidth: 1,
    borderColor: `${accent}35`,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  rewardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rewardLine: { fontSize: 14, fontWeight: '700', color: t.textPrimary },
  rewardMeta: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
  rewardNote: { fontSize: 11, color: t.textSecondary, lineHeight: 16 },
  paidPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: t.radiusChip,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  paidPillText: { fontSize: 11, fontWeight: '700', color: t.success },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pillActive: { backgroundColor: accent, borderColor: accent },
  pillText: { fontSize: 12, fontWeight: '600', color: '#D1D5DB', textTransform: 'capitalize' },
  pillTextActive: { color: '#000' },
  pillStatus: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submissionName: { fontSize: 14, fontWeight: '700', color: t.textPrimary, flex: 1, paddingRight: 8 },
  submissionStatus: { fontSize: 11, fontWeight: '700', color: t.textSecondary, textTransform: 'capitalize' },
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
  // Accept / reject / flag palette — deliberately raw (green/red/amber status set stays together).
  acceptBtn: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' },
  rejectBtn: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
  flagBtn: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' },
  btnBusy: { opacity: 0.6 },
  actionText: { fontSize: 13, fontWeight: '600' },
  acceptText: { color: '#22C55E' },
  rejectText: { color: '#EF4444' },
  flagText: { color: '#F59E0B' },
  // "Remove" (soft-delete) is a quieter, full-width destructive control below the
  // review row — it voids a row without counting as a scout rejection.
  removeBtn: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'transparent',
  },
  removeText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  rebuildBtn: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: `${accent}40`,
    backgroundColor: `${accent}1F`,
  },
  rebuildText: { fontSize: 13, fontWeight: '600', color: accent },
  });
}
