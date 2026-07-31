'use client';

import { useCallback, useState } from 'react';
import { EyeOff, Eye, Flag, MessageSquare, ShieldAlert } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import type {
  FeedFlaggedAnswerRow,
  FeedModerationAuthorSummary,
  FeedModerationQueueRow,
} from 'lib/feed/moderation';
import {
  FEED_MODERATION_REASON,
  FEED_MODERATION_REASONS,
  FEED_MODERATION_REASON_LABEL,
  type FeedModerationReason,
} from 'lib/feed/constants';
import { getFeedAnnouncementsTokens, type FeedAnnouncementsTokens } from './feed-announcements-shared';

// Commons moderation — the admin surface for taking a member's post or reply down, and putting it
// back. Until this existed there was no moderation surface at all: the only way to remove something
// from the Commons was direct SQL, and `moderation_status` was a column nothing read.
//
// Two deliberate limits, both visible in this UI:
//   - Hide and restore, never delete. Deleting is unrecoverable and takes the reply thread with it.
//   - No edit. A moderator cannot rewrite a member's words and leave the member's name on them.

const CSRF_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

type TabKey = 'all' | 'hidden' | 'authors' | 'flagged';

type ModerationQueuePayload = {
  ok?: boolean;
  rows?: FeedModerationQueueRow[];
  hidden?: { posts: number; replies: number };
  authors?: FeedModerationAuthorSummary[];
  message?: string;
};

// Build the query suffix for the moderation queue fetch. Kept out of the component so the two
// optional filters do not add branches to the render function.
function buildModerationQuerySuffix(onlyHidden: boolean, authorUserId?: string | null): string {
  const query = new URLSearchParams();
  if (onlyHidden) query.set('hidden', '1');
  if (authorUserId) query.set('author', authorUserId);
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

// Pick the notice line for a hide/restore. `changed === false` means the row was already in the
// requested state, so nothing actually moved.
function moderationNotice(
  changed: boolean | undefined,
  nextHidden: boolean,
  hiddenMsg: string,
  shownMsg: string,
): string {
  if (changed === false) return 'Already in that state — nothing changed.';
  return nextHidden ? hiddenMsg : shownMsg;
}

// Shared hide/restore POST. Same endpoint shape for Commons rows and flagged answers; the caller
// supplies the URL and applies its own default message so the wording stays per-surface.
async function postModeration(
  url: string,
  nextHidden: boolean,
  reason: FeedModerationReason,
): Promise<{ ok: boolean; changed?: boolean; message?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: CSRF_HEADERS,
    body: JSON.stringify(nextHidden ? { hidden: true, reason } : { hidden: false }),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; changed?: boolean; message?: string }
    | null;
  if (!res.ok || !data?.ok) {
    return { ok: false, message: data?.message };
  }
  return { ok: true, changed: data.changed };
}

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 100, padding: '12px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function tabStyle(t: FeedAnnouncementsTokens, active: boolean) {
  return {
    padding: '6px 16px',
    borderRadius: 8,
    background: active ? t.ACCENT : t.SURFACE,
    border: `1px solid ${active ? t.ACCENT : t.BORDER_SOLID}`,
    color: active ? '#fff' : t.MUTED,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as const;
}

function HiddenStats({ hidden }: { hidden: { posts: number; replies: number } }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      <StatBlock label="Hidden posts" value={hidden.posts} accent={hidden.posts > 0 ? '#F59E0B' : undefined} />
      <StatBlock label="Hidden replies" value={hidden.replies} accent={hidden.replies > 0 ? '#F59E0B' : undefined} />
    </div>
  );
}

function ModerationTabs({
  tab,
  focusAuthor,
  pendingFlagged,
  onSwitch,
}: {
  tab: TabKey;
  focusAuthor: FeedModerationAuthorSummary | null;
  pendingFlagged: number;
  onSwitch: (next: TabKey) => void;
}) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  const recentActive = tab === 'all' && !focusAuthor;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => onSwitch('all')} aria-pressed={recentActive} style={tabStyle(t, recentActive)}>
        Recent
      </button>
      <button type="button" onClick={() => onSwitch('hidden')} aria-pressed={tab === 'hidden'} style={tabStyle(t, tab === 'hidden')}>
        Hidden only
      </button>
      <button type="button" onClick={() => onSwitch('authors')} aria-pressed={tab === 'authors'} style={tabStyle(t, tab === 'authors')}>
        By member
      </button>
      <button type="button" onClick={() => onSwitch('flagged')} aria-pressed={tab === 'flagged'} style={tabStyle(t, tab === 'flagged')}>
        Flagged answers{pendingFlagged > 0 ? ` (${pendingFlagged})` : ''}
      </button>
    </div>
  );
}

// The reason applied to the next hide. One picker for the whole list rather than one per row:
// a sweep of off-topic posts is the same judgment repeated, and asking for it on every card
// would be twenty identical clicks. Restoring ignores this.
function ReasonPicker({ reason, onChange }: { reason: FeedModerationReason; onChange: (r: FeedModerationReason) => void }) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <label htmlFor="ctf-moderation-reason" style={{ fontSize: 12.5, color: t.MUTED }}>
        Hide reason
      </label>
      <select
        id="ctf-moderation-reason"
        value={reason}
        onChange={(e) => onChange(e.target.value as FeedModerationReason)}
        style={{ padding: '6px 10px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13 }}
      >
        {FEED_MODERATION_REASONS.map((code) => (
          <option key={code} value={code}>{FEED_MODERATION_REASON_LABEL[code]}</option>
        ))}
      </select>
    </div>
  );
}

function FocusAuthorHeader({ author, onBack }: { author: FeedModerationAuthorSummary; onBack: () => void }) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <span style={{ fontSize: 13, color: t.TITLE }}>
        Everything from {author.authorUsername ? `@${author.authorUsername}` : author.authorUserId}
        {' — '}
        {author.postCount} post{author.postCount === 1 ? '' : 's'}, {author.replyCount} repl{author.replyCount === 1 ? 'y' : 'ies'}
        {author.hiddenCount > 0 ? `, ${author.hiddenCount} already hidden` : ''}
      </span>
      <button type="button" onClick={onBack} style={{ padding: '4px 10px', borderRadius: 8, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        Back to members
      </button>
    </div>
  );
}

// The hide/restore button shared by Commons rows and flagged answers. Restore is green, hide is
// amber; the label differs per surface but the shape is identical.
function HideToggleButton({
  isHidden,
  busy,
  hideLabel,
  onClick,
}: {
  isHidden: boolean;
  busy: boolean;
  hideLabel: string;
  onClick: () => void;
}) {
  const colors = isHidden
    ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', color: '#22C55E' }
    : { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#F59E0B' };
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
      }}
    >
      {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
      {busy ? 'Saving…' : isHidden ? 'Put back' : hideLabel}
    </button>
  );
}

function FlaggedAnswerCard({
  row,
  busy,
  onToggle,
}: {
  row: FeedFlaggedAnswerRow;
  busy: boolean;
  onToggle: (row: FeedFlaggedAnswerRow, nextHidden: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  const isHidden = row.moderationStatus === 'hidden';
  return (
    <div style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${isHidden ? 'rgba(245,158,11,0.35)' : t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          <Flag size={10} style={{ verticalAlign: '-1px', marginRight: 3 }} />
          {row.flaggedCount} flag{row.flaggedCount === 1 ? '' : 's'}
        </span>
        {row.notHelpfulCount > 0 ? (
          <span style={{ fontSize: 11.5, color: t.MUTED }}>{row.notHelpfulCount} marked not helpful</span>
        ) : null}
        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${t.ACCENT}1f`, color: t.ACCENT, border: `1px solid ${t.ACCENT}4d` }}>
          {row.answerType === 'llm' ? 'Assistant' : 'Member'}
        </span>
        {isHidden ? (
          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
            Hidden{row.moderationReason ? ` · ${FEED_MODERATION_REASON_LABEL[row.moderationReason]}` : ''}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 12.5, color: t.MUTED, marginBottom: 6 }}>
        Asked: {row.questionBody}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: t.TITLE, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 10 }}>
        {row.answerBody}
      </div>

      <HideToggleButton isHidden={isHidden} busy={busy} hideLabel="Hide answer" onClick={() => onToggle(row, !isHidden)} />
    </div>
  );
}

function FlaggedTab({
  flagged,
  busyId,
  onToggle,
}: {
  flagged: FeedFlaggedAnswerRow[];
  busyId: string | null;
  onToggle: (row: FeedFlaggedAnswerRow, nextHidden: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  if (flagged.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
        No answers have been flagged.
      </div>
    );
  }
  return (
    <>
      <p style={{ fontSize: 12.5, color: t.MUTED, marginTop: 0, marginBottom: 12 }}>
        Answers members flagged, most-flagged first. Until now these went nowhere — the count was
        being collected and no screen showed it. Hiding an answer leaves the question up, so the
        member who asked still has their question and can get a better answer.
      </p>
      {flagged.map((row) => (
        <FlaggedAnswerCard key={row.answerId} row={row} busy={busyId === row.answerId} onToggle={onToggle} />
      ))}
    </>
  );
}

function AuthorRow({ author, onOpen }: { author: FeedModerationAuthorSummary; onOpen: (a: FeedModerationAuthorSummary) => void }) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  const a = author;
  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 10, padding: '12px 14px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, cursor: 'pointer' }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, wordBreak: 'break-all' }}>
        {a.authorUsername ? `@${a.authorUsername}` : a.authorUserId}
      </div>
      <div style={{ fontSize: 12, color: t.MUTED }}>
        {a.postCount} post{a.postCount === 1 ? '' : 's'} · {a.replyCount} repl{a.replyCount === 1 ? 'y' : 'ies'}
        {a.hiddenCount > 0 ? ` · ${a.hiddenCount} hidden` : ''}
        {' · first '}{new Date(a.firstPostedAtIso).toLocaleDateString()}
        {' · last '}{new Date(a.lastPostedAtIso).toLocaleDateString()}
      </div>
    </button>
  );
}

function AuthorsTab({ authors, onOpen }: { authors: FeedModerationAuthorSummary[]; onOpen: (a: FeedModerationAuthorSummary) => void }) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  if (authors.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
        Nobody has posted in the Commons yet.
      </div>
    );
  }
  return (
    <>
      <p style={{ fontSize: 12.5, color: t.MUTED, marginTop: 0, marginBottom: 12 }}>
        Ordered by how much each member has posted. Someone who wandered off topic once looks
        different here from an account that has never been on topic — open a member to read
        everything they have written before deciding.
      </p>
      {authors.map((a) => (
        <AuthorRow key={a.authorUserId} author={a} onOpen={onOpen} />
      ))}
    </>
  );
}

function QueueRowCard({
  row,
  busy,
  onToggle,
}: {
  row: FeedModerationQueueRow;
  busy: boolean;
  onToggle: (row: FeedModerationQueueRow, nextHidden: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  const isHidden = row.moderationStatus === 'hidden';
  return (
    <div style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${isHidden ? 'rgba(245,158,11,0.35)' : t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${t.ACCENT}1f`, color: t.ACCENT, border: `1px solid ${t.ACCENT}4d` }}>
          {row.target === 'reply' ? 'Reply' : 'Post'}
        </span>
        {isHidden ? (
          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
            {/* The reason rides on the Hidden pill, so a later pass can tell an off-topic
                sweep apart from an abuse removal without opening the audit log. */}
            Hidden{row.moderationReason ? ` · ${FEED_MODERATION_REASON_LABEL[row.moderationReason]}` : ''}
          </span>
        ) : null}
        <span style={{ fontSize: 12, color: t.MUTED }}>
          {row.authorUsername ? `@${row.authorUsername}` : row.authorUserId}
          {' · '}
          {new Date(row.createdAtIso).toLocaleString()}
        </span>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.6, color: t.TITLE, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 10 }}>
        {row.body}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <HideToggleButton isHidden={isHidden} busy={busy} hideLabel="Hide" onClick={() => onToggle(row, !isHidden)} />
        {row.target === 'reply' && row.postId ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: t.MUTED }}>
            <MessageSquare size={12} /> on post {row.postId.slice(0, 8)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function QueueTab({
  rows,
  tab,
  busyId,
  onToggle,
}: {
  rows: FeedModerationQueueRow[];
  tab: TabKey;
  busyId: string | null;
  onToggle: (row: FeedModerationQueueRow, nextHidden: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  if (rows.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
        {tab === 'hidden' ? 'Nothing is hidden.' : 'No Commons posts yet.'}
      </div>
    );
  }
  return (
    <>
      {rows.map((row) => (
        <QueueRowCard key={`${row.target}-${row.id}`} row={row} busy={busyId === row.id} onToggle={onToggle} />
      ))}
    </>
  );
}

export function CommonsModerationAdminShell({
  rows: initialRows,
  hidden: initialHidden,
  authors: initialAuthors,
  flagged: initialFlagged,
  pendingFlagged: initialPendingFlagged,
}: {
  rows: FeedModerationQueueRow[];
  hidden: { posts: number; replies: number };
  authors: FeedModerationAuthorSummary[];
  flagged: FeedFlaggedAnswerRow[];
  pendingFlagged: number;
}) {
  const { theme } = useTheme();
  const t = getFeedAnnouncementsTokens(theme);
  const [rows, setRows] = useState(initialRows);
  const [hidden, setHidden] = useState(initialHidden);
  const [authors, setAuthors] = useState(initialAuthors);
  const [tab, setTab] = useState<TabKey>('all');
  const [flagged, setFlagged] = useState(initialFlagged);
  const [pendingFlagged, setPendingFlagged] = useState(initialPendingFlagged);
  const [focusAuthor, setFocusAuthor] = useState<FeedModerationAuthorSummary | null>(null);
  // The reason applied to the next hide. Defaults to off-topic because that is the actual
  // day-to-day judgment — Quora-style discussion unrelated to the economy — so a sweep of twenty
  // posts should not mean picking the same option twenty times.
  const [reason, setReason] = useState<FeedModerationReason>(FEED_MODERATION_REASON.offTopic);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Apply a queue payload to state. Only replace the roster when the response carried one — a
  // single-author request returns an empty array by design, and overwriting with it would blank
  // the roster you came from.
  const applyQueueData = useCallback((data: ModerationQueuePayload) => {
    if (Array.isArray(data.rows)) setRows(data.rows);
    if (data.hidden) setHidden(data.hidden);
    if (Array.isArray(data.authors) && data.authors.length > 0) setAuthors(data.authors);
  }, []);

  const reload = useCallback(async (onlyHidden: boolean, authorUserId?: string | null) => {
    setError(null);
    const suffix = buildModerationQuerySuffix(onlyHidden, authorUserId);
    try {
      const res = await fetch(`/api/feed/admin/moderation${suffix}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as ModerationQueuePayload | null;
      if (res.ok && data?.ok && Array.isArray(data.rows)) {
        applyQueueData(data);
      } else {
        setError(data?.message ?? 'Could not load the moderation queue.');
      }
    } catch {
      setError('Could not load the moderation queue.');
    }
  }, [applyQueueData]);

  const reloadFlagged = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/feed/admin/moderation/flagged-answers', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; answers?: FeedFlaggedAnswerRow[]; pending?: number; message?: string }
        | null;
      if (res.ok && data?.ok && Array.isArray(data.answers)) {
        setFlagged(data.answers);
        if (typeof data.pending === 'number') setPendingFlagged(data.pending);
      } else {
        setError(data?.message ?? 'Could not load flagged answers.');
      }
    } catch {
      setError('Could not load flagged answers.');
    }
  }, []);

  function switchTab(next: TabKey) {
    setTab(next);
    setFocusAuthor(null);
    if (next === 'flagged') void reloadFlagged();
    else if (next !== 'authors') void reload(next === 'hidden', null);
  }

  // Hide or restore one flagged answer. Same endpoint as the Commons rows, target 'answer'.
  async function setAnswerHidden(row: FeedFlaggedAnswerRow, nextHidden: boolean) {
    if (!nextHidden && !window.confirm('Put this answer back where members can see it?')) {
      return;
    }
    setBusyId(row.answerId);
    setError(null);
    setNotice(null);
    try {
      const result = await postModeration(`/api/feed/admin/moderation/answer/${row.answerId}`, nextHidden, reason);
      if (!result.ok) {
        setError(result.message ?? 'Could not change that answer.');
        return;
      }
      setNotice(moderationNotice(result.changed, nextHidden, 'Answer hidden. The question stays up.', 'Answer is visible again.'));
      await reloadFlagged();
    } catch {
      setError('Could not change that answer.');
    } finally {
      setBusyId(null);
    }
  }

  function openAuthor(author: FeedModerationAuthorSummary) {
    setFocusAuthor(author);
    setTab('all');
    void reload(false, author.authorUserId);
  }

  async function setHiddenState(row: FeedModerationQueueRow, nextHidden: boolean) {
    // Hiding is reversible, so it does not need a confirm gate. Restoring puts content back in front
    // of members, which is the direction worth a deliberate pause.
    if (!nextHidden && !window.confirm('Put this back in the Commons where members can see it?')) {
      return;
    }
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      const result = await postModeration(`/api/feed/admin/moderation/${row.target}/${row.id}`, nextHidden, reason);
      if (!result.ok) {
        setError(result.message ?? 'Could not change that post.');
        return;
      }
      setNotice(moderationNotice(
        result.changed,
        nextHidden,
        'Hidden from the Commons. It is not deleted — you can put it back.',
        'Back in the Commons.',
      ));
      await reload(tab === 'hidden', focusAuthor?.authorUserId ?? null);
    } catch {
      setError('Could not change that post.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <MobileScreenHeader
        title="Commons Moderation"
        accent={t.ACCENT}
        icon={<ShieldAlert size={18} color={t.ACCENT} />}
        actions={<PluginUserShellButton href="/" accent={t.ACCENT} label="Commons" />}
      />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        <HiddenStats hidden={hidden} />

        <p style={{ fontSize: 13, lineHeight: 1.6, color: t.MUTED, marginTop: 0, marginBottom: 16 }}>
          Hiding takes a post out of the Commons for everyone. It is <strong>not</strong> deletion — the
          words are still there and you can put them back. There is no edit here on purpose: nobody
          should be able to rewrite a member&apos;s post and leave their name on it.
        </p>

        <ModerationTabs tab={tab} focusAuthor={focusAuthor} pendingFlagged={pendingFlagged} onSwitch={switchTab} />

        {tab !== 'authors' ? <ReasonPicker reason={reason} onChange={setReason} /> : null}

        {focusAuthor ? <FocusAuthorHeader author={focusAuthor} onBack={() => switchTab('authors')} /> : null}

        {error ? (
          <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>{error}</div>
        ) : null}
        {notice ? (
          <div role="status" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13 }}>{notice}</div>
        ) : null}

        {tab === 'flagged' ? (
          <FlaggedTab flagged={flagged} busyId={busyId} onToggle={setAnswerHidden} />
        ) : tab === 'authors' ? (
          <AuthorsTab authors={authors} onOpen={openAuthor} />
        ) : (
          <QueueTab rows={rows} tab={tab} busyId={busyId} onToggle={setHiddenState} />
        )}
      </div>
    </div>
  );
}
