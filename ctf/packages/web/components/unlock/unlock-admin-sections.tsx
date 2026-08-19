'use client';

import { RefreshCw } from 'lucide-react';
import type { UnlockSubmission } from 'lib/unlock/types';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';
import { queueEmptyMessage } from './unlock-admin-actions';
import {
  UnlockSubmissionCard,
  type UnlockEditorState,
  type UnlockHistoryState,
} from './unlock-admin-card';

type Tab = 'pending' | 'support-only' | 'all';
type ReviewStatus = UnlockSubmission['reviewStatus'];

export function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 92, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// The "Retry pending rewards" self-heal bar.
export function UnlockRetryRewardsBar({
  reconciling,
  pendingRewardCount,
  onRetry,
}: {
  reconciling: boolean;
  pendingRewardCount: number;
  onRetry: () => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <button
        type="button"
        onClick={onRetry}
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
  );
}

// The Pending / Support-only / All tab row.
export function UnlockQueueTabs({ tab, setTab, tabLabel }: { tab: Tab; setTab: (value: Tab) => void; tabLabel: Record<Tab, string> }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {(['pending', 'support-only', 'all'] as const).map((tabKey) => (
        <button
          key={tabKey}
          type="button"
          onClick={() => setTab(tabKey)}
          aria-pressed={tab === tabKey}
          style={{ padding: '6px 16px', borderRadius: 8, background: tab === tabKey ? t.ACCENT : t.SURFACE, border: `1px solid ${tab === tabKey ? t.ACCENT : t.BORDER_SOLID}`, color: tab === tabKey ? '#fff' : t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {tabLabel[tabKey]}
        </button>
      ))}
    </div>
  );
}

// On the support-only tab, say how many of the loaded page this list is actually showing (the page is
// capped, so the list can hold fewer support-only rows than the dashboard counter reports). Renders
// nothing outside that tab or while a search is active — the caller passes tab/searchQuery so that
// condition lives here rather than adding branches to the shell.
export function UnlockSupportOnlyNote({
  tab,
  searchQuery,
  visibleCount,
  lockedSupportOnlyCount,
}: {
  tab: Tab;
  searchQuery: string;
  visibleCount: number;
  lockedSupportOnlyCount: number;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  if (tab !== 'support-only' || searchQuery) {
    return null;
  }
  const allShown = visibleCount === lockedSupportOnlyCount;
  return (
    <div style={{ marginTop: -8, marginBottom: 16, fontSize: 12, color: t.MUTED }}>
      {allShown
        ? `${visibleCount} member${visibleCount === 1 ? '' : 's'} on support-only access`
        : `Showing ${visibleCount} of ${lockedSupportOnlyCount} on support-only access — the rest are outside this page of submissions.`}
    </div>
  );
}

// Search box over the loaded page, with a live match count.
export function UnlockSearchBox({
  search,
  setSearch,
  searchQuery,
  matchCount,
}: {
  search: string;
  setSearch: (value: string) => void;
  searchQuery: string;
  matchCount: number;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
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
          {matchCount} match{matchCount === 1 ? '' : 'es'}
        </div>
      ) : null}
    </div>
  );
}

// Error (alert) and notice (status) banners.
export function UnlockBanners({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error ? (
        <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>{error}</div>
      ) : null}
      {notice ? (
        <div role="status" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13 }}>{notice}</div>
      ) : null}
    </>
  );
}

export type UnlockQueueListProps = {
  items: UnlockSubmission[];
  searchQuery: string;
  tab: Tab;
  busyId: number | null;
  editor: UnlockEditorState;
  history: UnlockHistoryState;
  confirmRevokeId: number | null;
  setConfirmRevokeId: (value: number | null) => void;
  confirmSpamId: number | null;
  setConfirmSpamId: (value: number | null) => void;
  onReview: (id: number, reviewStatus: ReviewStatus) => void;
  onGrantReward: (id: number) => void;
  onRevoke: (id: number) => void;
};

// The submission list (or the empty state).
export function UnlockSubmissionList(props: UnlockQueueListProps) {
  const { items, searchQuery, tab, busyId, editor, history, confirmRevokeId, setConfirmRevokeId, confirmSpamId, setConfirmSpamId, onReview, onGrantReward, onRevoke } = props;
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  if (items.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
        {queueEmptyMessage(searchQuery, tab)}
      </div>
    );
  }
  return (
    <>
      {items.map((s) => (
        <UnlockSubmissionCard
          key={s.id}
          s={s}
          busy={busyId === s.id}
          editor={editor}
          history={history}
          confirmRevokeId={confirmRevokeId}
          setConfirmRevokeId={setConfirmRevokeId}
          confirmSpamId={confirmSpamId}
          setConfirmSpamId={setConfirmSpamId}
          onReview={onReview}
          onGrantReward={onGrantReward}
          onRevoke={onRevoke}
        />
      ))}
    </>
  );
}
