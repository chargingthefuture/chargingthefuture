// Unlock admin screen (mobile) — verification queue with approve / reject actions.
// Mirrors the web admin at ctf/packages/web/app/admin/unlock and the mockup
// design/.../survivor-hub/MobileUnlockAdmin.tsx. Binds only existing endpoints:
//   GET  /api/unlock/admin/submissions?reviewStatus=pending|approved (or no filter for all)
//   POST /api/unlock/admin/submissions/:submissionId/review  (x-ctf-csrf: '1')
// Admin access is enforced server-side; a 401/403 surfaces an "admins only" notice.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme, getAppAccent, type ThemeTokens } from "../../theme";
import { UNLOCK_REWARD_SLA_HOURS } from "./constants";
import { usePluginAuth } from "./usePluginAuth";
import { reportError, reasonText } from '../../observability/report';
import {
  fetchExperimentSplit,
  fetchSubmissions,
  reconcileRewards,
  reviewSubmission,
  type UnlockAdminQueueFilter,
  type UnlockAdminSubmission,
  type UnlockExperimentBucketStat,
  type UnlockReviewDecision,
} from "./admin-api";

// Status tabs, mirroring the web admin shell. 'Approved' surfaces approved-but-uncredited rows (reward
// pending) that need operator attention; 'All' shows every status.
const QUEUE_TABS: { key: UnlockAdminQueueFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "all", label: "All" },
];

const PANEL = "#0D0F14";
const BORDER = "rgba(255,255,255,0.08)";

type AdminStyles = ReturnType<typeof makeStyles>;

// The full-screen spinner shows while auth is resolving, or while the queue is loading and no
// forbidden/error state has replaced it. Extracted so the screen stays within the rule-116
// complexity limit.
function shouldShowSpinner(
  authLoading: boolean,
  loading: boolean,
  forbidden: boolean,
  error: string | null,
): boolean {
  return authLoading || (loading && !forbidden && error === null);
}

// Section heading text combining the active-tab label with an optional match-count suffix when a
// search is active. Extracted so the render stays within the rule-116 complexity limit.
function sectionHeadingText(
  filter: UnlockAdminQueueFilter,
  search: string,
  matchCount: number,
): string {
  const base =
    filter === "pending"
      ? "Pending submissions"
      : filter === "approved"
        ? "Approved submissions"
        : "All submissions";
  const suffix = search.trim() ? ` · ${matchCount} match${matchCount === 1 ? "" : "es"}` : "";
  return base + suffix;
}

// Read-only A/B experiment readout. Split out of AdminUnlock so the screen stays within the rule-116
// complexity limit; markup and behavior are unchanged.
function ExperimentPanel({
  s,
  experiment,
  accent,
  textSecondary,
}: {
  s: AdminStyles;
  experiment: UnlockExperimentBucketStat[];
  accent: string;
  textSecondary: string;
}) {
  return (
    <View style={s.experimentPanel}>
      <Text style={s.experimentTitle}>Early Commons access — A/B experiment</Text>
      <Text style={s.experimentSubtitle}>
        Quora-URL completion rate by bucket. Treatment members get early access to the Commons to
        ask for help before verifying.
      </Text>
      {experiment.length === 0 ? (
        <Text style={s.experimentEmpty}>
          No experiment data yet. Turn on the feature-unlock-early-commons-access rollout in Unleash
          (sticky on userId) to start the test.
        </Text>
      ) : (
        <View style={s.experimentGrid}>
          {experiment.map((row) => {
            const label =
              row.bucket === "early_commons"
                ? "Early Commons (treatment)"
                : row.bucket === "control"
                  ? "Control"
                  : row.bucket;
            const labelColor = row.bucket === "early_commons" ? accent : textSecondary;
            return (
              <View key={row.bucket} style={s.experimentCard}>
                <Text style={[s.experimentBucketLabel, { color: labelColor }]}>{label}</Text>
                <Text style={s.experimentPct}>{row.completionPct}%</Text>
                <Text style={s.experimentMeta}>
                  {row.submitted} of {row.exposed} submitted
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// Status tab row. `onSelect` receives the chosen queue filter.
function QueueTabs({
  s,
  filter,
  onSelect,
}: {
  s: AdminStyles;
  filter: UnlockAdminQueueFilter;
  onSelect: (_key: UnlockAdminQueueFilter) => void;
}) {
  return (
    <View style={s.tabRow}>
      {QUEUE_TABS.map((tab) => {
        const active = filter === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[s.tab, active ? s.tabActive : null]}
            onPress={() => onSelect(tab.key)}
            disabled={active}
          >
            <Text style={[s.tabText, active ? s.tabTextActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A single verification-queue card with its reward pill and (for pending rows) approve/reject actions.
function SubmissionCard({
  s,
  submission,
  acting,
  onReview,
}: {
  s: AdminStyles;
  submission: UnlockAdminSubmission;
  acting: number | null;
  onReview: (_submission: UnlockAdminSubmission, _reviewStatus: UnlockReviewDecision) => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.rowBetween}>
        <Text style={s.cardTitle}>Submission #{submission.id}</Text>
        <Text style={[s.cardStatus, { color: "#F59E0B" }]}>{submission.reviewStatus}</Text>
      </View>
      {submission.reviewStatus === "approved" ? (
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
            {submission.incentiveGrantedAt ? "Reward granted" : "Reward pending"}
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
      {submission.reviewStatus === "pending" ? (
        <View style={s.actionRow}>
          <Pressable
            style={[s.actionBtn, s.acceptBtn, acting === submission.id ? s.btnBusy : null]}
            onPress={() => onReview(submission, "approved")}
            disabled={acting === submission.id}
          >
            <Text style={[s.actionText, s.acceptText]}>Approve</Text>
          </Pressable>
          <Pressable
            style={[s.actionBtn, s.rejectBtn, acting === submission.id ? s.btnBusy : null]}
            onPress={() => onReview(submission, "rejected")}
            disabled={acting === submission.id}
          >
            <Text style={[s.actionText, s.rejectText]}>Reject</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// The queue body: the empty-state line, or the list of submission cards.
function SubmissionList({
  s,
  filtered,
  search,
  acting,
  onReview,
}: {
  s: AdminStyles;
  filtered: UnlockAdminSubmission[];
  search: string;
  acting: number | null;
  onReview: (_submission: UnlockAdminSubmission, _reviewStatus: UnlockReviewDecision) => void;
}) {
  if (filtered.length === 0) {
    return (
      <Text style={s.emptyText}>
        {search.trim() ? "No submissions match your search." : "No submissions in this view."}
      </Text>
    );
  }
  return (
    <>
      {filtered.map((submission) => (
        <SubmissionCard
          key={submission.id}
          s={s}
          submission={submission}
          acting={acting}
          onReview={onReview}
        />
      ))}
    </>
  );
}

export const AdminUnlock = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent("unlock", theme);
  const s = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const { auth, loading: authLoading } = usePluginAuth("clerk");

  const [items, setItems] = useState<UnlockAdminSubmission[]>([]);
  const [experiment, setExperiment] = useState<UnlockExperimentBucketStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [filter, setFilter] = useState<UnlockAdminQueueFilter>("pending");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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

  // `background` skips the full-screen spinner so pull-to-refresh keeps the current queue visible.
  const load = useCallback(
    async (background = false) => {
      if (!auth?.isAuthenticated || !auth.userId) return;
      setError(null);
      if (!background) setLoading(true);
      const result = await fetchSubmissions(filter);
      if (result.forbidden) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      setForbidden(false);
      if (!result.ok && result.message) setError(result.message);
      setItems(result.items);
      // Read-only A/B experiment split alongside the queue. Best-effort: a failure here never blocks the
      // queue, and an empty rows array is the normal "rollout not started yet" state.
      const experimentResult = await fetchExperimentSplit();
      if (experimentResult.ok) setExperiment(experimentResult.rows);
      setLoading(false);
    },
    [auth, filter],
  );

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  // Pull-to-refresh: re-pull the queue without flashing the loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const runReview = useCallback(
    async (submissionId: number, reviewStatus: UnlockReviewDecision) => {
      if (!auth?.userId) return;
      setActing(submissionId);
      setError(null);
      setNotice(null);
      try {
        await reviewSubmission(submissionId, reviewStatus);
        setNotice(reviewStatus === "approved" ? "Submission approved." : "Submission rejected.");
        await load();
      } catch (caught) {
        reportError(caught, { area: 'unlock', op: 'admin_review_submission' });
        setError(`Could not review the submission: ${reasonText(caught)}`);
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
        result.withheld > 0 ? ` ${result.withheld} held for a duplicate-identity review.` : "";
      setNotice(
        `Retried rewards — scanned ${result.scanned}, granted ${result.granted}, ` +
          `already granted ${result.alreadyGranted}, withheld ${result.withheld}, failed ${result.failed}.` +
          heldNote,
      );
      await load();
    } catch (caught) {
      reportError(caught, { area: 'unlock', op: 'admin_retry_rewards' });
      setError(`Could not retry pending rewards: ${reasonText(caught)}`);
    } finally {
      setReconciling(false);
    }
  }, [auth, load]);

  // State-changing decisions require an explicit confirm gesture.
  const confirmReconcile = useCallback(() => {
    Alert.alert(
      "Retry pending rewards",
      "Mint any approved-but-uncredited verification reward now? Safe to run repeatedly — it never double-grants.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Retry rewards", style: "default", onPress: () => void runReconcile() },
      ],
    );
  }, [runReconcile]);

  const confirmReview = useCallback(
    (submission: UnlockAdminSubmission, reviewStatus: UnlockReviewDecision) => {
      const verb = reviewStatus === "approved" ? "Approve" : "Reject";
      Alert.alert(
        `${verb} submission`,
        `${verb} the verification request for ${submission.userId}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: verb,
            style: reviewStatus === "rejected" ? "destructive" : "default",
            onPress: () => void runReview(submission.id, reviewStatus),
          },
        ],
      );
    },
    [runReview],
  );

  if (shouldShowSpinner(authLoading, loading, forbidden, error)) {
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
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />
      }
    >
      <Text style={s.title}>Unlock Admin</Text>
      <Text style={s.subtitle}>
        Verification queue. Approve or reject pending Quora profile submissions. Rewards are issued
        automatically and arrive within {UNLOCK_REWARD_SLA_HOURS} hours — if a reward is still
        pending it will be retried in the background.
      </Text>

      {/* Early Commons access A/B experiment readout. Driven by the experimentBucket recorded on the
          unlock.status.get / unlock.verification.submit audit rows. Empty until the Unleash rollout is on.
          Mirrors the web unlock-admin-shell.tsx panel. Read-only. */}
      <ExperimentPanel
        s={s}
        experiment={experiment}
        accent={accent}
        textSecondary={tokens.textSecondary}
      />

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

      <QueueTabs s={s} filter={filter} onSelect={setFilter} />

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

      <Text style={s.sectionHeading}>{sectionHeadingText(filter, search, filtered.length)}</Text>
      <SubmissionList
        s={s}
        filtered={filtered}
        search={search}
        acting={acting}
        onReview={confirmReview}
      />
    </ScrollView>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 16 },
    center: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    title: { fontSize: 20, fontWeight: "800", color: t.textPrimary },
    subtitle: { fontSize: 13, color: t.textSecondary, lineHeight: 19 },
    noticeText: { fontSize: 14, color: t.textSecondary, textAlign: "center" },
    errorBanner: {
      fontSize: 13,
      color: "#FCA5A5",
      backgroundColor: "rgba(239,68,68,0.1)",
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.3)",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noticeBanner: {
      fontSize: 13,
      color: "#86EFAC",
      backgroundColor: "rgba(34,197,94,0.1)",
      borderWidth: 1,
      borderColor: "rgba(34,197,94,0.3)",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    reconcileBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      backgroundColor: `${accent}1F`,
      borderColor: `${accent}4D`,
    },
    reconcileBtnText: { fontSize: 13, fontWeight: "700", color: accent },
    experimentPanel: {
      backgroundColor: PANEL,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 14,
      padding: 16,
      gap: 4,
    },
    experimentTitle: { fontSize: 14, fontWeight: "700", color: t.textPrimary },
    experimentSubtitle: { fontSize: 12, color: t.textSecondary, lineHeight: 18, marginBottom: 6 },
    experimentEmpty: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
    experimentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    experimentCard: {
      flexGrow: 1,
      flexBasis: 140,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    experimentBucketLabel: { fontSize: 12, fontWeight: "700" },
    experimentPct: { fontSize: 20, fontWeight: "800", color: t.textPrimary },
    experimentMeta: { fontSize: 11, color: t.textSecondary },
    emptyText: { fontSize: 13, color: t.textSecondary },
    tabRow: { flexDirection: "row", gap: 8 },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: PANEL,
    },
    tabActive: { backgroundColor: `${accent}1F`, borderColor: `${accent}4D` },
    tabText: { fontSize: 13, fontWeight: "600", color: t.textSecondary },
    tabTextActive: { color: accent },
    sectionHeading: { fontSize: 16, fontWeight: "700", color: t.textPrimary },
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
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitle: { fontSize: 14, fontWeight: "700", color: t.textPrimary },
    cardStatus: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
    rewardPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: t.radiusChip,
      borderWidth: 1,
      marginTop: 2,
    },
    rewardPillGranted: {
      backgroundColor: "rgba(34,197,94,0.12)",
      borderColor: "rgba(34,197,94,0.3)",
    },
    rewardPillPending: {
      backgroundColor: "rgba(245,158,11,0.12)",
      borderColor: "rgba(245,158,11,0.3)",
    },
    rewardPillText: { fontSize: 11, fontWeight: "700" },
    rewardPillTextGranted: { color: "#22C55E" },
    rewardPillTextPending: { color: "#F59E0B" },
    cardMeta: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
    cardUrl: { fontSize: 12, color: "#D1D5DB", lineHeight: 18 },
    actionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
    actionBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 9,
      borderWidth: 1,
    },
    acceptBtn: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.3)" },
    rejectBtn: { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" },
    btnBusy: { opacity: 0.6 },
    actionText: { fontSize: 13, fontWeight: "600" },
    acceptText: { color: "#22C55E" },
    rejectText: { color: "#EF4444" },
  });
}
