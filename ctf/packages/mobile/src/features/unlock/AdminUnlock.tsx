// Unlock admin screen (mobile) — verification queue with approve / reject actions.
// Mirrors the web admin at ctf/packages/web/app/admin/unlock and the mockup
// design/.../survivor-hub/MobileUnlockAdmin.tsx. Binds only existing endpoints:
//   GET  /api/unlock/admin/submissions?reviewStatus=pending|approved (or no filter for all)
//   POST /api/unlock/admin/submissions/:submissionId/review  (x-ctf-csrf: '1')
// Admin access is enforced server-side; a 401/403 surfaces an "admins only" notice.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { UNLOCK_REWARD_SLA_HOURS } from './constants';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import {
  fetchSubmissions,
  reconcileRewards,
  reviewSubmission,
  type UnlockAdminQueueFilter,
  type UnlockAdminSubmission,
  type UnlockReviewDecision,
} from './admin-api';

// Status tabs, mirroring the web admin shell. 'Approved' surfaces approved-but-uncredited rows (reward
// pending) that need operator attention; 'All' shows every status.
const QUEUE_TABS: { key: UnlockAdminQueueFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'all', label: 'All' },
];

const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';

export const AdminUnlock = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('unlock', theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [items, setItems] = useState<UnlockAdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [filter, setFilter] = useState<UnlockAdminQueueFilter>('pending');
  const [search, setSearch] = useState('');

  // Client-side filter over the loaded page so an admin can find a submission by Quora URL, user id,
  // or submission number without scrolling the whole list.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (submission) =>
        submission.quoraProfileUrl.toLowerCase().includes(q) ||
        submission.quoraProfileUrlNormalized.toLowerCase().includes(q) ||
        submission.userId.toLowerCase().includes(q) ||
        String(submission.id).includes(q),
    );
  }, [items, search]);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    setLoading(true);
    const result = await fetchSubmissions(filter);
    if (result.forbidden) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setForbidden(false);
    if (!result.ok && result.message) setError(result.message);
    setItems(result.items);
    setLoading(false);
  }, [auth, filter]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const runReview = useCallback(
    async (submissionId: number, reviewStatus: UnlockReviewDecision) => {
      if (!auth?.userId) return;
      setActing(submissionId);
      setError(null);
      setNotice(null);
      try {
        await reviewSubmission(submissionId, reviewStatus);
        setNotice(reviewStatus === 'approved' ? 'Submission approved.' : 'Submission rejected.');
        await load();
      } catch {
        setError('Could not review the submission. Try again.');
      } finally {
        setActing(null);
      }
    },
    [auth, load],
  );

  const runReconcile = useCallback(async () => {
    if (!auth?.userId) return;
    setReconciling(true);
    setError(null);
    setNotice(null);
    try {
      const result = await reconcileRewards();
      const heldNote =
        result.withheld > 0
          ? ` ${result.withheld} held for a duplicate-identity review.`
          : '';
      setNotice(
        `Retried rewards — scanned ${result.scanned}, granted ${result.granted}, ` +
          `already granted ${result.alreadyGranted}, withheld ${result.withheld}, failed ${result.failed}.` +
          heldNote,
      );
      await load();
    } catch {
      setError('Could not retry pending rewards. Try again.');
    } finally {
      setReconciling(false);
    }
  }, [auth, load]);

  // State-changing decisions require an explicit confirm gesture.
  const confirmReconcile = useCallback(() => {
    Alert.alert(
      'Retry pending rewards',
      'Mint any approved-but-uncredited verification reward now? Safe to run repeatedly — it never double-grants.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry rewards', style: 'default', onPress: () => void runReconcile() },
      ],
    );
  }, [runReconcile]);

  const confirmReview = useCallback(
    (submission: UnlockAdminSubmission, reviewStatus: UnlockReviewDecision) => {
      const verb = reviewStatus === 'approved' ? 'Approve' : 'Reject';
      Alert.alert(
        `${verb} submission`,
        `${verb} the verification request for ${submission.userId}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: verb,
            style: reviewStatus === 'rejected' ? 'destructive' : 'default',
            onPress: () => void runReview(submission.id, reviewStatus),
          },
        ],
      );
    },
    [runReview],
  );

  if (authLoading || (loading && !forbidden && error === null)) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={s.center}>
        <Text style={s.noticeText}>The Unlock admin tools are available to admins only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.title}>Unlock Admin</Text>
      <Text style={s.subtitle}>
        Verification queue. Approve or reject pending Quora profile submissions. Rewards are issued
        automatically and arrive within {UNLOCK_REWARD_SLA_HOURS} hours — if a reward is still pending it
        will be retried in the background.
      </Text>

      <Pressable
        style={[s.reconcileBtn, reconciling ? s.btnBusy : null]}
        onPress={confirmReconcile}
        disabled={reconciling}
      >
        {reconciling ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Text style={s.reconcileBtnText}>Retry pending rewards</Text>
        )}
      </Pressable>

      {error ? <Text style={s.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={s.noticeBanner}>{notice}</Text> : null}

      <View style={s.tabRow}>
        {QUEUE_TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[s.tab, active ? s.tabActive : null]}
              onPress={() => setFilter(tab.key)}
              disabled={active}
            >
              <Text style={[s.tabText, active ? s.tabTextActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={s.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by Quora URL, user, or submission #"
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel="Search submissions"
      />

      <Text style={s.sectionHeading}>
        {filter === 'pending' ? 'Pending submissions' : filter === 'approved' ? 'Approved submissions' : 'All submissions'}
        {search.trim() ? ` · ${filtered.length} match${filtered.length === 1 ? '' : 'es'}` : ''}
      </Text>
      {filtered.length === 0 ? (
        <Text style={s.emptyText}>
          {search.trim() ? 'No submissions match your search.' : 'No submissions in this view.'}
        </Text>
      ) : (
        filtered.map((submission) => (
          <React.Fragment key={submission.id}>
            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>Submission #{submission.id}</Text>
                <Text style={[s.cardStatus, { color: '#F59E0B' }]}>{submission.reviewStatus}</Text>
              </View>
              {submission.reviewStatus === 'approved' ? (
                <View
                  style={[
                    s.rewardPill,
                    submission.incentiveGrantedAt ? s.rewardPillGranted : s.rewardPillPending,
                  ]}
                >
                  <Text
                    style={[
                      s.rewardPillText,
                      submission.incentiveGrantedAt ? s.rewardPillTextGranted : s.rewardPillTextPending,
                    ]}
                  >
                    {submission.incentiveGrantedAt ? 'Reward granted' : 'Reward pending'}
                  </Text>
                </View>
              ) : null}
              <Text style={s.cardMeta}>User: {submission.userId}</Text>
              <Text style={s.cardUrl} numberOfLines={2}>
                {submission.quoraProfileUrl}
              </Text>
              <Text style={s.cardMeta}>Tier: {submission.accessTier}</Text>
              <Text style={s.cardMeta}>
                Window expires: {submission.unlockWindowExpiresAt.slice(0, 10)}
              </Text>
              {submission.reviewStatus === 'pending' ? (
                <View style={s.actionRow}>
                  <Pressable
                    style={[s.actionBtn, s.acceptBtn, acting === submission.id ? s.btnBusy : null]}
                    onPress={() => confirmReview(submission, 'approved')}
                    disabled={acting === submission.id}
                  >
                    <Text style={[s.actionText, s.acceptText]}>Approve</Text>
                  </Pressable>
                  <Pressable
                    style={[s.actionBtn, s.rejectBtn, acting === submission.id ? s.btnBusy : null]}
                    onPress={() => confirmReview(submission, 'rejected')}
                    disabled={acting === submission.id}
                  >
                    <Text style={[s.actionText, s.rejectText]}>Reject</Text>
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
    reconcileBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      backgroundColor: `${accent}1F`,
      borderColor: `${accent}4D`,
    },
    reconcileBtnText: { fontSize: 13, fontWeight: '700', color: accent },
    emptyText: { fontSize: 13, color: t.textSecondary },
    tabRow: { flexDirection: 'row', gap: 8 },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: PANEL,
    },
    tabActive: { backgroundColor: `${accent}1F`, borderColor: `${accent}4D` },
    tabText: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    tabTextActive: { color: accent },
    sectionHeading: { fontSize: 16, fontWeight: '700', color: t.textPrimary },
    searchInput: {
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: t.textPrimary,
    },
    card: {
      backgroundColor: PANEL,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 14,
      padding: 16,
      gap: 6,
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: t.textPrimary },
    cardStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    rewardPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: t.radiusChip, borderWidth: 1, marginTop: 2 },
    rewardPillGranted: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' },
    rewardPillPending: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' },
    rewardPillText: { fontSize: 11, fontWeight: '700' },
    rewardPillTextGranted: { color: '#22C55E' },
    rewardPillTextPending: { color: '#F59E0B' },
    cardMeta: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
    cardUrl: { fontSize: 12, color: '#D1D5DB', lineHeight: 18 },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
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
    acceptText: { color: '#22C55E' },
    rejectText: { color: '#EF4444' },
  });
}
