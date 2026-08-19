'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { Unlock } from 'lucide-react';
import { UNLOCK_REWARD_SLA_HOURS } from 'lib/unlock/constants';
import type {
  SpamQuoraUrlEntry,
  UnlockDashboardSnapshot,
  UnlockExperimentBucketStat,
  UnlockSignupOverview,
  UnlockSubmission,
} from 'lib/unlock/types';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';
import { UnlockSignupsPanel } from './unlock-signups-panel';
import { UnlockSpamDenylistPanel } from './unlock-spam-denylist-panel';
import {
  grantReward,
  retryRewards,
  reviewSubmission,
  revokeReward,
  saveUrl,
  toggleHistory,
  type QuoraHistoryEntry,
  type UnlockAdminActionCtx,
} from './unlock-admin-actions';
import type { UnlockEditorState, UnlockHistoryState } from './unlock-admin-card';
import {
  StatBlock,
  UnlockBanners,
  UnlockExperimentPanel,
  UnlockQueueTabs,
  UnlockRetryRewardsBar,
  UnlockSearchBox,
  UnlockSubmissionList,
  UnlockSupportOnlyNote,
} from './unlock-admin-sections';

type Tab = 'pending' | 'support-only' | 'all';

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Pending',
  'support-only': 'Support-only',
  all: 'All submissions',
};

export function UnlockAdminShell({
  dashboard,
  submissions: initialSubmissions,
  experimentSplit = [],
  spamDenylist = [],
  signupOverview,
}: {
  dashboard: UnlockDashboardSnapshot;
  submissions: UnlockSubmission[];
  experimentSplit?: UnlockExperimentBucketStat[];
  spamDenylist?: SpamQuoraUrlEntry[];
  signupOverview?: UnlockSignupOverview;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  // Marking spam blocks the member from the whole app (an 'all'-scope account restriction), so the Spam
  // button is guarded by an inline confirm the same way the reward-revoke lock is.
  const [confirmSpamId, setConfirmSpamId] = useState<number | null>(null);
  const [historyOpenUser, setHistoryOpenUser] = useState<string | null>(null);
  const [historyByUser, setHistoryByUser] = useState<Record<string, QuoraHistoryEntry[]>>({});
  const [historyLoadingUser, setHistoryLoadingUser] = useState<string | null>(null);

  function closeEditor() {
    setEditingId(null);
    setEditUrl('');
    setEditError(null);
  }

  // State setters the module-level action functions drive. Rebuilt each render (cheap) — actions run on events.
  const ctx: UnlockAdminActionCtx = {
    router,
    setBusyId,
    setReconciling,
    setError,
    setNotice,
    setSubmissions,
    setConfirmRevokeId,
    setSavingUrl,
    setEditError,
    closeEditor,
    setHistoryOpenUser,
    setHistoryByUser,
    setHistoryLoadingUser,
  };

  const editor: UnlockEditorState = {
    editingId,
    editUrl,
    savingUrl,
    editError,
    setEditUrl,
    start: (s) => {
      setEditingId(s.id);
      setEditUrl(s.quoraProfileUrl);
      setEditError(null);
    },
    cancel: closeEditor,
    save: (id) => void saveUrl(ctx, id, editUrl),
  };

  const history: UnlockHistoryState = {
    openUser: historyOpenUser,
    byUser: historyByUser,
    loadingUser: historyLoadingUser,
    toggle: (userId) => void toggleHistory(ctx, userId, historyOpenUser, historyByUser),
  };

  // Which slice of the loaded submissions the list shows. 'support-only' filters on access tier rather
  // than review status, because a member lands there from more than one route — rejected, or a lapsed
  // pending window swept by supportOnlyAfterExpiry — and the tier is the one thing those share.
  //
  // Spam is the exception and is excluded. A spam decision drops the tier to locked_support_only AND
  // places a platform-wide account restriction; the restriction is what decides, so the member reaches
  // nothing at all. Listing them under "support-only access" said the opposite of their real access.
  // The dashboard counter excludes them the same way, so the number and the list still agree.
  const visible =
    tab === 'pending'
      ? submissions.filter((s) => s.reviewStatus === 'pending')
      : tab === 'support-only'
        ? submissions.filter((s) => s.accessTier === 'locked_support_only' && s.reviewStatus !== 'spam')
        : submissions;
  const searchQuery = search.trim().toLowerCase();
  const filteredVisible = searchQuery
    ? visible.filter(
        (s) =>
          s.quoraProfileUrl.toLowerCase().includes(searchQuery) ||
          s.quoraProfileUrlNormalized.toLowerCase().includes(searchQuery) ||
          s.userId.toLowerCase().includes(searchQuery) ||
          String(s.id).includes(searchQuery),
      )
    : visible;
  const pendingRewardCount = submissions.filter((s) => s.reviewStatus === 'approved' && !s.incentiveGrantedAt).length;

  return (
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each shell owns its own
        // vertical scroll; on mobile the document scrolls, so only set a min-height there.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      {/* Unlock's member surface is /plugin/unlock, NOT /apps/unlock (the plugin is registered
          isVisible: false, so /apps/unlock 404s for everyone, admins included). */}
      <MobileScreenHeader title="Unlock Admin" accent={t.ACCENT} icon={<Unlock size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/plugin/unlock" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <StatBlock label="Pending" value={dashboard.pendingCount} accent="#F59E0B" />
          <StatBlock label="Approved" value={dashboard.approvedCount} accent="#22C55E" />
          <StatBlock label="Rejected" value={dashboard.rejectedCount} accent="#EF4444" />
          <StatBlock label="Spam" value={dashboard.spamCount} />
          <StatBlock label="Support-only" value={dashboard.lockedSupportOnlyCount} />
        </div>

        {signupOverview ? <UnlockSignupsPanel overview={signupOverview} /> : null}

        <UnlockExperimentPanel experimentSplit={experimentSplit} />

        <UnlockRetryRewardsBar reconciling={reconciling} pendingRewardCount={pendingRewardCount} onRetry={() => void retryRewards(ctx)} />

        <UnlockQueueTabs tab={tab} setTab={setTab} tabLabel={TAB_LABEL} />

        <UnlockSupportOnlyNote tab={tab} searchQuery={searchQuery} visibleCount={visible.length} lockedSupportOnlyCount={dashboard.lockedSupportOnlyCount} />

        <UnlockSearchBox search={search} setSearch={setSearch} searchQuery={searchQuery} matchCount={filteredVisible.length} />

        <UnlockBanners error={error} notice={notice} />

        <UnlockSubmissionList
          items={filteredVisible}
          searchQuery={searchQuery}
          tab={tab}
          busyId={busyId}
          editor={editor}
          history={history}
          confirmRevokeId={confirmRevokeId}
          setConfirmRevokeId={setConfirmRevokeId}
          confirmSpamId={confirmSpamId}
          setConfirmSpamId={setConfirmSpamId}
          onReview={(id, reviewStatus) => void reviewSubmission(ctx, id, reviewStatus)}
          onGrantReward={(id) => void grantReward(ctx, id)}
          onRevoke={(id) => void revokeReward(ctx, id)}
        />

        <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginTop: 16 }}>
          Approving grants full access and mints the ServiceCredits verification reward. Rejecting keeps the member on support-only access; marking spam blocks them from the whole app and adds their Quora URL to the denylist below. Rewards are issued on approval and the background self-heal retries any that did not land within {UNLOCK_REWARD_SLA_HOURS} hours. If a reward is still showing pending, use Retry pending rewards above to grant it now. A Quora profile earns the reward on one account: if the same profile is approved on another account, its reward is <strong>held</strong> for your determination — use <strong>Grant reward</strong> to award the account you choose, and <strong>Revoke reward</strong> to claw it back from the others (a perp impersonating a victim is exactly this case).
        </p>

        <UnlockSpamDenylistPanel initialEntries={spamDenylist} />
      </div>
    </div>
  );
}
