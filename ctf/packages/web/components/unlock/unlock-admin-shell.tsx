'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { Unlock, Key, CheckCircle, XCircle, Ban, RefreshCw, Pencil } from 'lucide-react';
import { UNLOCK_REWARD_SLA_HOURS } from 'lib/unlock/constants';
import type { UnlockDashboardSnapshot, UnlockExperimentBucketStat, UnlockSubmission } from 'lib/unlock/types';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';

// Admin design tokens (shared admin look from the design system) come from the theme-aware
// Unlock tokens: accent (purple), page background, panel/header, admin card surface, and the
// solid admin border. The default theme keeps the shipped hex values.

type ReviewStatus = UnlockSubmission['reviewStatus'];
// Which slice of the loaded submissions the list shows. 'support-only' is not a review status — it is
// the access tier a member is left on when they are not approved (rejected, marked spam, or their
// pending window lapsed and the support-only sweep ran). The Support-only counter on the dashboard
// above is the same set, so the tab is the way to see WHO those people are rather than just how many.
type Tab = 'pending' | 'support-only' | 'all';

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Pending',
  'support-only': 'Support-only',
  all: 'All submissions',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)', label: 'pending' },
  approved: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)', label: 'approved' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.3)', label: 'rejected' },
  spam: { bg: 'rgba(107,114,128,0.14)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)', label: 'spam' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// Reward-status pill for an approved submission. Green when the 100-ServiceCredits reward has
// landed (incentiveGrantedAt set); muted amber while it is still pending the background retry.
function RewardPill({ grantedAt }: { grantedAt: string | null }) {
  const granted = grantedAt !== null;
  const style = granted
    ? { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' }
    : { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' };
  const label = granted ? 'Reward granted' : 'Reward pending';
  return (
    <span
      title={granted ? `Granted ${new Date(grantedAt as string).toLocaleDateString()}` : undefined}
      style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {label}
    </span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 92, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// One Quora URL change from the admin history read (GET /api/unlock/admin/quora-history). Kept local
// so the client component does not import the server repository module.
type QuoraHistoryEntry = {
  id: string;
  userId: string;
  previousUrl: string | null;
  newUrl: string;
  changedByUserId: string;
  source: 'directory_self' | 'directory_admin' | 'unlock_onboarding';
  createdAtIso: string;
};

function historySourceLabel(source: QuoraHistoryEntry['source']): string {
  switch (source) {
    case 'unlock_onboarding':
      return 'set at onboarding';
    case 'directory_self':
      return 'changed by member in Directory';
    case 'directory_admin':
      return 'changed by an admin';
    default:
      return source;
  }
}

export function UnlockAdminShell({
  dashboard,
  submissions: initialSubmissions,
  experimentSplit = [],
}: {
  dashboard: UnlockDashboardSnapshot;
  submissions: UnlockSubmission[];
  experimentSplit?: UnlockExperimentBucketStat[];
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
  // Inline URL editor state: which submission is being edited, the draft URL, a per-editor error,
  // and whether the save request is in flight.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState(false);
  // Which submission is awaiting an explicit revoke confirmation (revoke burns the reward, so it is a
  // money action — never one-click).
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  // Quora URL history, loaded on demand per member. Which member's history panel is open, plus a
  // per-member cache and loading marker. A member who changed their social-proof URL after approval
  // (or tried to remove it — an empty submission keeps the previous URL) shows up here.
  const [historyOpenUser, setHistoryOpenUser] = useState<string | null>(null);
  const [historyByUser, setHistoryByUser] = useState<Record<string, QuoraHistoryEntry[]>>({});
  const [historyLoadingUser, setHistoryLoadingUser] = useState<string | null>(null);

  // Open/close a member's Quora URL history, fetching it the first time.
  async function toggleHistory(userId: string): Promise<void> {
    if (historyOpenUser === userId) {
      setHistoryOpenUser(null);
      return;
    }
    setHistoryOpenUser(userId);
    if (historyByUser[userId]) {
      return;
    }
    setHistoryLoadingUser(userId);
    try {
      const res = await fetch(`/api/unlock/admin/quora-history?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as { history?: QuoraHistoryEntry[]; message?: string } | null;
      if (res.ok && Array.isArray(data?.history)) {
        setHistoryByUser((current) => ({ ...current, [userId]: data.history as QuoraHistoryEntry[] }));
      } else {
        setError(data?.message ?? 'Could not load Quora URL history.');
      }
    } catch {
      setError('Could not load Quora URL history.');
    } finally {
      setHistoryLoadingUser(null);
    }
  }

  const visible =
    tab === 'pending'
      ? submissions.filter((s) => s.reviewStatus === 'pending')
      : tab === 'support-only'
        // Filtered on access tier, not review status, deliberately: a member lands here from more than
        // one route (rejected, spam, or a lapsed pending window swept by supportOnlyAfterExpiry), and
        // the tier is the single thing all of those have in common. It also matches exactly what the
        // Support-only counter above is counting, so the number and the list can never disagree.
        ? submissions.filter((s) => s.accessTier === 'locked_support_only')
        : submissions;
  // Client-side search over the loaded page so an admin can find a submission by Quora URL, user id,
  // or submission number without scrolling the whole list.
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
  // Approved submissions whose 100-credit reward never landed (incentive_granted_at still null). These
  // are exactly the rows the "Retry pending rewards" drain will mint. Counted from the loaded page.
  const pendingRewardCount = submissions.filter((s) => s.reviewStatus === 'approved' && !s.incentiveGrantedAt).length;

  async function retryRewards() {
    setReconciling(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/unlock/admin/reconcile-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; granted?: number; alreadyGranted?: number; withheld?: number; failed?: number; errors?: { submissionId: number; message: string }[]; reason?: string; code?: string; message?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.reason ?? data?.message ?? data?.code ?? `Retry failed (${res.status}).`);
        return;
      }
      const granted = data.granted ?? 0;
      const failed = data.failed ?? 0;
      const withheld = data.withheld ?? 0;
      const reasons = (data.errors ?? []).map((e) => `#${e.submissionId}: ${e.message}`).join('; ');
      // Note any rewards the duplicate-identity guard held so the operator knows to make a determination.
      const heldNote = withheld > 0 ? ` ${withheld} held for duplicate-identity review.` : '';
      if (failed > 0) {
        // Surface the mint failure reason so the operator can act on it (e.g. a mint budget cap or a
        // misconfigured incentive amount) rather than seeing a silent "still pending".
        setError(`Granted ${granted}. ${failed} could not be granted${reasons ? ` — ${reasons}` : ''}.${heldNote}`);
      } else {
        setNotice(
          (granted > 0 ? `Granted ${granted} pending reward${granted === 1 ? '' : 's'}.` : 'No pending rewards to grant.') + heldNote,
        );
      }
      // Refresh so the snapshot counts and reward pills reflect the freshly granted rewards.
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setReconciling(false);
    }
  }

  async function review(id: number, reviewStatus: ReviewStatus) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/unlock/admin/submissions/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ reviewStatus }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; rewardWithheld?: boolean; reason?: string; code?: string } | null;
      if (!res.ok) {
        setError(data?.reason ?? data?.code ?? `Review failed (${res.status}).`);
        return;
      }
      // Optimistically reflect the decision, then refresh so the snapshot counts update too.
      setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, reviewStatus } : s)));
      if (data?.rewardWithheld) {
        setNotice('Approved, but the reward is held: this Quora profile is already on another account. Decide which account keeps it — Grant reward here, or Revoke it from the other.');
      }
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  // Duplicate-identity determination: grant a held reward to this account (the admin decided this account
  // keeps the Quora identity). Fails with a clear message if another account still holds it.
  async function grantReward(id: number) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/unlock/admin/submissions/${id}/grant-reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; submission?: UnlockSubmission; holderUserId?: string; message?: string; reason?: string; code?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? data?.reason ?? data?.code ?? `Grant failed (${res.status}).`);
        return;
      }
      if (data.submission) {
        setSubmissions((prev) => prev.map((x) => (x.id === id ? (data.submission as UnlockSubmission) : x)));
      }
      setNotice('Reward granted to this account.');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  // Duplicate-identity determination: revoke a reward (claws the credits back via a burn and drops the
  // account to support-only + rejected). Used for the "loser" of a determination, or a perp impersonating
  // a victim. Confirmed inline first.
  async function revoke(id: number) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/unlock/admin/submissions/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ reviewNote: 'Reward revoked — duplicate Quora identity' }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; submission?: UnlockSubmission; creditsReclaimed?: boolean; reclaimAmount?: number; message?: string; reason?: string; code?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? data?.reason ?? data?.code ?? `Revoke failed (${res.status}).`);
        return;
      }
      if (data.submission) {
        setSubmissions((prev) => prev.map((x) => (x.id === id ? (data.submission as UnlockSubmission) : x)));
      }
      setNotice(
        data.creditsReclaimed
          ? `Revoked and reclaimed ${data.reclaimAmount ?? 0} credits.`
          : 'Revoked. No credits to reclaim (none were granted, or the account already spent them).',
      );
      setConfirmRevokeId(null);
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  function startEditUrl(s: UnlockSubmission) {
    setEditingId(s.id);
    setEditUrl(s.quoraProfileUrl);
    setEditError(null);
  }

  function cancelEditUrl() {
    setEditingId(null);
    setEditUrl('');
    setEditError(null);
  }

  async function saveUrl(id: number) {
    setSavingUrl(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/unlock/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ quoraProfileUrl: editUrl }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; submission?: UnlockSubmission; reason?: string; code?: string; message?: string }
        | null;
      if (!res.ok || !data?.ok || !data.submission) {
        setEditError(data?.message ?? data?.reason ?? data?.code ?? `Save failed (${res.status}).`);
        return;
      }
      // Reflect the corrected (re-normalized) URL from the server, then refresh so any
      // server-rendered view stays in sync. Close the editor.
      const saved = data.submission;
      setSubmissions((prev) => prev.map((s) => (s.id === id ? saved : s)));
      cancelEditUrl();
      router.refresh();
    } catch {
      setEditError('Network error. Try again.');
    } finally {
      setSavingUrl(false);
    }
  }

  return (
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each shell must own
        // its vertical scroll — otherwise a long queue is clipped and unreachable. On mobile the
        // document scrolls, so only set a min-height there. Matches the skills-hunt / weekly-performance
        // admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      {/* Unlock's member surface is /plugin/unlock, NOT /apps/unlock. The plugin is registered with
          isVisible: false so it stays out of the app launcher, and /apps/[pluginSlug] calls
          notFound() on any plugin that is not visible — so an /apps/unlock link 404s for everyone,
          admins included (owner report, 2026-07-26). */}
      <MobileScreenHeader title="Unlock Admin" accent={t.ACCENT} icon={<Unlock size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/plugin/unlock" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}
        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <StatBlock label="Pending" value={dashboard.pendingCount} accent="#F59E0B" />
          <StatBlock label="Approved" value={dashboard.approvedCount} accent="#22C55E" />
          <StatBlock label="Rejected" value={dashboard.rejectedCount} accent="#EF4444" />
          <StatBlock label="Spam" value={dashboard.spamCount} />
          <StatBlock label="Support-only" value={dashboard.lockedSupportOnlyCount} />
        </div>

        {/* Early Commons access A/B experiment readout. Driven by the experimentBucket recorded on the
            unlock.status.get / unlock.verification.submit audit rows. Empty until the Unleash rollout is on. */}
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 2 }}>Early Commons access — A/B experiment</div>
          <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 10 }}>
            Quora-URL completion rate by bucket. Treatment members get early access to the Commons to ask for help before verifying.
          </div>
          {experimentSplit.length === 0 ? (
            <div style={{ fontSize: 12, color: t.MUTED }}>
              No experiment data yet. Turn on the <code>feature-unlock-early-commons-access</code> rollout in Unleash (sticky on userId) to start the test.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {experimentSplit.map((row) => {
                const label =
                  row.bucket === 'early_commons' ? 'Early Commons (treatment)' : row.bucket === 'control' ? 'Control' : row.bucket;
                const accent = row.bucket === 'early_commons' ? t.ACCENT : t.SUBTLE;
                return (
                  <div key={row.bucket} style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE }}>{row.completionPct}%</div>
                    <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>
                      {row.submitted} of {row.exposed} submitted
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reward self-heal: grant any approved verification whose reward is still pending. Idempotent. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            type="button"
            onClick={retryRewards}
            disabled={reconciling}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: `${t.ACCENT}1A`, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: reconciling ? 'not-allowed' : 'pointer', opacity: reconciling ? 0.6 : 1 }}
          >
            <RefreshCw size={13} /> {reconciling ? 'Retrying…' : 'Retry pending rewards'}
          </button>
          {pendingRewardCount > 0 ? (
            <span style={{ fontSize: 12, color: t.MUTED }}>
              {pendingRewardCount} approved submission{pendingRewardCount === 1 ? '' : 's'} awaiting reward
            </span>
          ) : null}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['pending', 'support-only', 'all'] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              aria-pressed={tab === tabKey}
              style={{ padding: '6px 16px', borderRadius: 8, background: tab === tabKey ? t.ACCENT : t.SURFACE, border: `1px solid ${tab === tabKey ? t.ACCENT : t.BORDER_SOLID}`, color: tab === tabKey ? '#fff' : t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {TAB_LABEL[tabKey]}
            </button>
          ))}
        </div>

        {/* On the support-only tab, say how many of them this page is actually showing. The page loads a
            capped number of submissions, so once there are more than that the list can hold fewer
            support-only rows than the counter above reports — and a short list would otherwise read as
            "that is everyone". Say the shortfall out loud instead. */}
        {tab === 'support-only' && !searchQuery ? (
          <div style={{ marginTop: -8, marginBottom: 16, fontSize: 12, color: t.MUTED }}>
            {visible.length === dashboard.lockedSupportOnlyCount
              ? `${visible.length} member${visible.length === 1 ? '' : 's'} on support-only access`
              : `Showing ${visible.length} of ${dashboard.lockedSupportOnlyCount} on support-only access — the rest are outside this page of submissions.`}
          </div>
        ) : null}

        {/* Search over the loaded submissions so an admin need not scroll the whole list. */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Quora URL, user, or submission #"
            aria-label="Search submissions"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13 }}
          />
          {searchQuery ? (
            <div style={{ marginTop: 6, fontSize: 12, color: t.MUTED }}>
              {filteredVisible.length} match{filteredVisible.length === 1 ? '' : 'es'}
            </div>
          ) : null}
        </div>

        {error ? (
          <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>{error}</div>
        ) : null}

        {notice ? (
          <div role="status" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13 }}>{notice}</div>
        ) : null}

        {filteredVisible.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
            {searchQuery
              ? 'No submissions match your search.'
              : tab === 'pending'
                ? 'No submissions waiting for review.'
                : tab === 'support-only'
                  ? 'Nobody is on support-only access. Rejected, spam, and lapsed submissions land here.'
                  : 'No submissions yet.'}
          </div>
        ) : (
          filteredVisible.map((s) => {
            const busy = busyId === s.id;
            const rewardHeld = Boolean(s.rewardWithheldAt) && !s.incentiveGrantedAt && !s.rewardRevokedAt;
            const canRevoke = s.reviewStatus === 'approved' && !s.rewardRevokedAt;
            return (
              <div key={s.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                {editingId === s.id ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <Key size={14} color={t.ACCENT} style={{ flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          type="url"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          aria-label="Quora profile URL"
                          disabled={savingUrl}
                          style={{ flex: 1, minWidth: 200, padding: '6px 10px', borderRadius: 8, background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13 }}
                        />
                        <button type="button" disabled={savingUrl} onClick={() => saveUrl(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: `${t.ACCENT}1A`, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: savingUrl ? 'not-allowed' : 'pointer', opacity: savingUrl ? 0.6 : 1 }}>
                          <CheckCircle size={13} /> {savingUrl ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" disabled={savingUrl} onClick={cancelEditUrl} style={{ padding: '6px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: savingUrl ? 'not-allowed' : 'pointer', opacity: savingUrl ? 0.6 : 1 }}>
                          Cancel
                        </button>
                      </div>
                      {editError ? (
                        <div role="alert" style={{ fontSize: 12, color: '#EF4444' }}>{editError}</div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 6 }}>
                    {/* URL on its own full-width row so a long Quora link wraps across the card width
                        instead of being crushed to one character per line by the action pills that used
                        to share this row (owner report, 2026-07-29). */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <Key size={14} color={t.ACCENT} style={{ flexShrink: 0, marginTop: 3 }} />
                      <a href={s.quoraProfileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
                        {s.quoraProfileUrl}
                      </a>
                    </div>
                    {/* Action pills and buttons wrap onto as many rows as they need, below the URL. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" aria-label="Edit URL" title="Edit URL" onClick={() => startEditUrl(s)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <StatusPill status={s.reviewStatus} />
                      {/* Access tier, shown only when it is support-only. Review status alone does not
                          explain why a row is on this tier: a submission left `pending` past its window
                          is swept to support-only by supportOnlyAfterExpiry, so it would read "pending"
                          with nothing saying the member is actually locked out of the full app. */}
                      {s.accessTier === 'locked_support_only' ? (
                        <span title="This member is on support-only access — they can reach support surfaces but not the full app" style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(148,163,184,0.14)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.32)' }}>
                          Support-only
                        </span>
                      ) : null}
                      {s.reviewStatus === 'approved' && !s.rewardRevokedAt ? <RewardPill grantedAt={s.incentiveGrantedAt} /> : null}
                      {s.sharedUrlAccountCount && s.sharedUrlAccountCount > 1 ? (
                        <span title="This Quora URL is claimed by more than one account" style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                          Shared by {s.sharedUrlAccountCount}
                        </span>
                      ) : null}
                      {s.quoraUrlChangeCount && s.quoraUrlChangeCount > 1 ? (
                        <span title="This member has changed their Quora URL more than once — open the history to review. A change is not itself a problem (Quora sometimes deletes accounts)." style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                          URL changed {s.quoraUrlChangeCount}×
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void toggleHistory(s.userId)}
                        style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, cursor: 'pointer' }}
                      >
                        {historyOpenUser === s.userId ? 'Hide URL history' : 'URL history'}
                      </button>
                      {s.rewardWithheldAt && !s.incentiveGrantedAt && !s.rewardRevokedAt ? (
                        <span title="Another account already holds this Quora identity's reward — held for your determination" style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                          Reward withheld
                        </span>
                      ) : null}
                      {s.rewardRevokedAt ? (
                        <span title="Reward clawed back and access revoked" style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                          Reward revoked
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
                {s.quoraProfileUrlNormalized ? (
                  <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 4, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span>Normalized:</span>
                    <a href={s.quoraProfileUrlNormalized} target="_blank" rel="noopener noreferrer" style={{ color: t.ACCENT, fontWeight: 600, wordBreak: 'break-all' }}>
                      {s.quoraProfileUrlNormalized}
                    </a>
                    {s.quoraProfileUrlNormalized !== s.quoraProfileUrl ? (
                      <span style={{ color: t.SUBTLE, fontStyle: 'italic' }}>(cleaned from submitted link)</span>
                    ) : null}
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 4 }}>User: {s.userId}</div>
                {historyOpenUser === s.userId ? (
                  <div style={{ margin: '6px 0 10px', padding: 10, borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>Quora URL history</div>
                    {historyLoadingUser === s.userId && !historyByUser[s.userId] ? (
                      <div style={{ fontSize: 12, color: t.MUTED }}>Loading…</div>
                    ) : (historyByUser[s.userId]?.length ?? 0) === 0 ? (
                      <div style={{ fontSize: 12, color: t.MUTED }}>No URL changes recorded for this member.</div>
                    ) : (
                      <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {historyByUser[s.userId]?.map((entry) => (
                          <li key={entry.id} style={{ fontSize: 12, color: t.MUTED }}>
                            <div style={{ color: t.SUBTLE, marginBottom: 2 }}>
                              {new Date(entry.createdAtIso).toLocaleString()} · {historySourceLabel(entry.source)}
                            </div>
                            {entry.previousUrl ? (
                              <div style={{ wordBreak: 'break-all' }}>
                                <span style={{ color: t.SUBTLE }}>from</span> {entry.previousUrl}
                              </div>
                            ) : null}
                            <div style={{ wordBreak: 'break-all' }}>
                              <span style={{ color: t.SUBTLE }}>{entry.previousUrl ? 'to' : 'set'}</span>{' '}
                              <a href={entry.newUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.ACCENT, fontWeight: 600 }}>
                                {entry.newUrl}
                              </a>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 10 }}>
                  Submitted {new Date(s.createdAt).toLocaleDateString()} · window expires {new Date(s.unlockWindowExpiresAt).toLocaleDateString()} · tier {s.accessTier}
                </div>
                {s.reviewStatus === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" disabled={busy} onClick={() => review(s.id, 'approved')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button type="button" disabled={busy} onClick={() => review(s.id, 'rejected')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      <XCircle size={13} /> Reject
                    </button>
                    <button type="button" disabled={busy} onClick={() => review(s.id, 'spam')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(107,114,128,0.12)', border: '1px solid rgba(107,114,128,0.3)', color: '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      <Ban size={13} /> Spam
                    </button>
                  </div>
                ) : rewardHeld || canRevoke ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {rewardHeld ? (
                      <button type="button" disabled={busy} onClick={() => grantReward(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                        <CheckCircle size={13} /> Grant reward to this account
                      </button>
                    ) : null}
                    {canRevoke ? (
                      confirmRevokeId === s.id ? (
                        <>
                          <span style={{ fontSize: 12, color: '#FCD34D' }}>Reclaim the reward and lock this account?</span>
                          <button type="button" disabled={busy} onClick={() => revoke(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                            {busy ? 'Revoking…' : 'Confirm revoke'}
                          </button>
                          <button type="button" disabled={busy} onClick={() => setConfirmRevokeId(null)} style={{ padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => setConfirmRevokeId(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          <Ban size={13} /> Revoke reward
                        </button>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginTop: 16 }}>
          Approving grants full access and mints the ServiceCredits verification reward. Rejecting or marking spam keeps the member on support-only access. Rewards are issued on approval and the background self-heal retries any that did not land within {UNLOCK_REWARD_SLA_HOURS} hours. If a reward is still showing pending, use Retry pending rewards above to grant it now. A Quora profile earns the reward on one account: if the same profile is approved on another account, its reward is <strong>held</strong> for your determination — use <strong>Grant reward</strong> to award the account you choose, and <strong>Revoke reward</strong> to claw it back from the others (a perp impersonating a victim is exactly this case).
        </p>
      </div>
    </div>
  );
}
