// Unlock admin screen (mobile) — verification queue with approve / reject actions.
// Mirrors the web admin at ctf/packages/web/app/admin/unlock and the mockup
// design/.../survivor-hub/MobileUnlockAdmin.tsx. Binds only existing endpoints:
//   GET  /api/unlock/admin/submissions?reviewStatus=pending
//   POST /api/unlock/admin/submissions/:submissionId/review  (x-ctf-csrf: '1')
// Admin access is enforced server-side; a 401/403 surfaces an "admins only" notice.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UNLOCK_REWARD_SLA_HOURS } from './constants';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import {
  fetchPendingSubmissions,
  reviewSubmission,
  type UnlockAdminSubmission,
  type UnlockReviewDecision,
} from './admin-api';

const COLOR = '#C084FC';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';

export const AdminUnlock = () => {
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [items, setItems] = useState<UnlockAdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const result = await fetchPendingSubmissions();
    if (result.forbidden) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setForbidden(false);
    if (!result.ok && result.message) setError(result.message);
    setItems(result.items);
    setLoading(false);
  }, [auth]);

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

  // State-changing decisions require an explicit confirm gesture.
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={styles.center}>
        <Text style={styles.noticeText}>The Unlock admin tools are available to admins only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Unlock Admin</Text>
      <Text style={styles.subtitle}>
        Verification queue. Approve or reject pending Quora profile submissions. Rewards are issued
        automatically and arrive within {UNLOCK_REWARD_SLA_HOURS} hours — if a reward is still pending it
        will be retried in the background.
      </Text>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}

      <Text style={styles.sectionHeading}>Pending submissions</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No pending submissions.</Text>
      ) : (
        items.map((submission) => (
          <React.Fragment key={submission.id}>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Submission #{submission.id}</Text>
                <Text style={[styles.cardStatus, { color: '#F59E0B' }]}>{submission.reviewStatus}</Text>
              </View>
              {submission.reviewStatus === 'approved' ? (
                <View
                  style={[
                    styles.rewardPill,
                    submission.incentiveGrantedAt ? styles.rewardPillGranted : styles.rewardPillPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.rewardPillText,
                      submission.incentiveGrantedAt ? styles.rewardPillTextGranted : styles.rewardPillTextPending,
                    ]}
                  >
                    {submission.incentiveGrantedAt ? 'Reward granted' : 'Reward pending'}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.cardMeta}>User: {submission.userId}</Text>
              <Text style={styles.cardUrl} numberOfLines={2}>
                {submission.quoraProfileUrl}
              </Text>
              <Text style={styles.cardMeta}>Tier: {submission.accessTier}</Text>
              <Text style={styles.cardMeta}>
                Window expires: {submission.unlockWindowExpiresAt.slice(0, 10)}
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionBtn, styles.acceptBtn, acting === submission.id ? styles.btnBusy : null]}
                  onPress={() => confirmReview(submission, 'approved')}
                  disabled={acting === submission.id}
                >
                  <Text style={[styles.actionText, styles.acceptText]}>Approve</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.rejectBtn, acting === submission.id ? styles.btnBusy : null]}
                  onPress={() => confirmReview(submission, 'rejected')}
                  disabled={acting === submission.id}
                >
                  <Text style={[styles.actionText, styles.rejectText]}>Reject</Text>
                </Pressable>
              </View>
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
  sectionHeading: { fontSize: 16, fontWeight: '700', color: TEXT },
  card: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  cardStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  rewardPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, marginTop: 2 },
  rewardPillGranted: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.3)' },
  rewardPillPending: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' },
  rewardPillText: { fontSize: 11, fontWeight: '700' },
  rewardPillTextGranted: { color: '#22C55E' },
  rewardPillTextPending: { color: '#F59E0B' },
  cardMeta: { fontSize: 12, color: SUBTLE, lineHeight: 18 },
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
