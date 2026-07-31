'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ShieldCheck, ArrowUpRight, MessageCircle, Send } from 'lucide-react';
import type { HubAnnouncementReply, HubAnnouncementRepliesResponse } from '../../lib/hub/types';
import { FEED_MAX_COMMUNITY_REPLY_LENGTH } from '../../lib/feed/constants';
import type { ChatReactionSummary } from './shell-types';
import { ChatReactionRow } from './chat-reaction-row';
import styles from './community-shell.module.css';

type AnnouncementCardProps = {
  // The posting authority — almost always "Survivor Hub". Passed in so the card matches whatever
  // label the stream resolved rather than hardcoding it.
  senderName: string;
  // The announcement heading, shown bold above the body. Null when the announcement has no title.
  title: string | null;
  // The announcement body (the message text, with the title already split out server-side).
  body: string;
  // Display-only formatted time label (same one the chat bubbles use).
  time: string;
  // The plugins this announcement links to (0–3), each rendered as a clickable "Open <Plugin>" chip
  // below the body (in addition to the plain "Open <Plugin>: <url>" lines already in the body).
  linkedPlugins?: Array<{ slug: string; name: string }>;
  // The underlying announcement id — the id reactions and replies key on. Null on a synthetic card
  // (there is none in practice), in which case the reaction/reply affordances are not rendered.
  announcementId?: string | null;
  // Emoji reactions on this announcement, ordered by the fixed reaction set. Absent/empty when none.
  reactions?: ChatReactionSummary[];
  // The number of replies on this announcement at load time. The card keeps its own live count as
  // the member adds replies.
  replyCount?: number;
  // Toggle the member's emoji reaction on this announcement (optimistic in the parent hook).
  onToggleReaction?: (announcementId: string, emoji: string) => void;
};

function formatReplyTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// The reply-toggle label: a count once there are replies, otherwise the plain "Reply" call to action.
function formatReplyLabel(count: number): string {
  if (count <= 0) return 'Reply';
  return `${count} ${count === 1 ? 'reply' : 'replies'}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }
  return payload as T;
}

// The clickable "Open <Plugin>" chips below the body. Nothing to show when the announcement links to
// no plugins.
function AnnouncementLinkedPlugins({ linkedPlugins }: { linkedPlugins?: Array<{ slug: string; name: string }> }) {
  if (!linkedPlugins || linkedPlugins.length === 0) return null;
  return (
    <div className={styles.announcementChipRow}>
      {linkedPlugins.map((plugin) => (
        <Link key={plugin.slug} href={`/apps/${plugin.slug}`} className={styles.announcementChip}>
          <ArrowUpRight size={13} color="currentColor" /> Open {plugin.name}
        </Link>
      ))}
    </div>
  );
}

// A single reply within the thread.
function AnnouncementReplyItem({ reply }: { reply: HubAnnouncementReply }) {
  return (
    <div className={styles.announcementReply}>
      <div className={styles.announcementReplyMeta}>
        <span className={styles.announcementReplyAuthor}>{reply.isMine ? 'You' : reply.author}</span>
        <span className={styles.announcementReplyTime}>{formatReplyTime(reply.sentAtIso)}</span>
      </div>
      <p className={styles.announcementReplyBody}>{reply.body}</p>
    </div>
  );
}

type AnnouncementThreadProps = {
  loading: boolean;
  loaded: boolean;
  replies: HubAnnouncementReply[];
  error: string | null;
  replyInput: string;
  sending: boolean;
  onReplyInputChange: (value: string) => void;
  onSend: () => void;
};

// The expanded reply thread: loading/empty notes, the list of replies, an error line, and the
// composer. Loaded on demand by the parent when the thread is first opened.
function AnnouncementThread({
  loading,
  loaded,
  replies,
  error,
  replyInput,
  sending,
  onReplyInputChange,
  onSend,
}: AnnouncementThreadProps) {
  const showEmpty = !loading && loaded && replies.length === 0;
  const canSend = replyInput.trim().length > 0;
  const sendClassName = canSend
    ? `${styles.announcementReplySend} ${styles.announcementReplySendActive}`
    : styles.announcementReplySend;
  return (
    <div className={styles.announcementThread}>
      {loading ? <p className={styles.announcementThreadNote}>Loading replies…</p> : null}
      {showEmpty ? (
        <p className={styles.announcementThreadNote}>No replies yet. Be the first to reply.</p>
      ) : null}
      {replies.map((reply) => (
        <AnnouncementReplyItem key={reply.id} reply={reply} />
      ))}

      {error ? <p className={styles.announcementThreadError} role="status">{error}</p> : null}

      <div className={styles.announcementReplyComposer}>
        <textarea
          className={styles.announcementReplyInput}
          placeholder="Write a reply…"
          rows={1}
          value={replyInput}
          maxLength={FEED_MAX_COMMUNITY_REPLY_LENGTH}
          onChange={(event) => onReplyInputChange(event.target.value)}
          // Enter inserts a line break, it does not send — matches the main composer (owner
          // request 2026-07-20). Sending is only via the send button.
        />
        <button
          type="button"
          className={sendClassName}
          onClick={onSend}
          disabled={sending || !canSend}
          aria-label="Post reply"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

type AnnouncementEngagementProps = {
  announcementId: string;
  reactions?: ChatReactionSummary[];
  onToggleReaction?: (announcementId: string, emoji: string) => void;
  threadOpen: boolean;
  localCount: number;
  onToggleThread: () => void;
  thread: AnnouncementThreadProps;
};

// The reaction row plus the reply toggle, and the thread itself when open.
function AnnouncementEngagement({
  announcementId,
  reactions,
  onToggleReaction,
  threadOpen,
  localCount,
  onToggleThread,
  thread,
}: AnnouncementEngagementProps) {
  const replyLabel = formatReplyLabel(localCount);
  const toggleClassName = threadOpen
    ? `${styles.announcementReplyToggle} ${styles.announcementReplyToggleActive}`
    : styles.announcementReplyToggle;
  return (
    <div className={styles.announcementEngagement}>
      <div className={styles.announcementActions}>
        <ChatReactionRow
          postId={announcementId}
          reactions={reactions}
          onToggle={(id, emoji) => onToggleReaction?.(id, emoji)}
        />
        <button
          type="button"
          className={toggleClassName}
          onClick={onToggleThread}
          aria-expanded={threadOpen}
          aria-label={threadOpen ? 'Hide replies' : `Show replies (${localCount})`}
        >
          <MessageCircle size={13} /> {replyLabel}
        </button>
      </div>

      {threadOpen ? <AnnouncementThread {...thread} /> : null}
    </div>
  );
}

// Official Survivor Hub announcement, rendered as a distinct card (emerald treatment, shield
// "Official" badge) so it stands out from peer chat bubbles and AI answers instead of blending into
// the purple stream. Members can react to an announcement with the same fixed emoji quick set as a
// peer post, and reply to it — the replies group under the announcement as a thread (loaded on
// demand when the thread is opened).
export function AnnouncementCard({
  senderName,
  title,
  body,
  time,
  linkedPlugins,
  announcementId,
  reactions,
  replyCount,
  onToggleReaction,
}: AnnouncementCardProps) {
  const [threadOpen, setThreadOpen] = useState(false);
  const [replies, setReplies] = useState<HubAnnouncementReply[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [sending, setSending] = useState(false);
  const [localCount, setLocalCount] = useState(replyCount ?? 0);
  const [error, setError] = useState<string | null>(null);

  const loadReplies = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestJson<HubAnnouncementRepliesResponse>(
        `/api/announcements/${encodeURIComponent(id)}/replies`,
      );
      setReplies(payload.replies);
      setLocalCount(payload.replies.length);
      setLoaded(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load replies right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleThread = useCallback(() => {
    if (!announcementId) return;
    const next = !threadOpen;
    setThreadOpen(next);
    // Load the thread the first time it is opened; later opens reuse what we have.
    if (next && !loaded && !loading) {
      void loadReplies(announcementId);
    }
  }, [announcementId, threadOpen, loaded, loading, loadReplies]);

  const sendReply = useCallback(async () => {
    if (!announcementId) return;
    const text = replyInput.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      const payload = await requestJson<{ ok: true; reply: HubAnnouncementReply }>(
        `/api/announcements/${encodeURIComponent(announcementId)}/replies`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
          body: JSON.stringify({ body: text }),
        },
      );
      setReplies((previous) => [...previous, payload.reply]);
      setLocalCount((previous) => previous + 1);
      setLoaded(true);
      setReplyInput('');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to post your reply right now.');
    } finally {
      setSending(false);
    }
  }, [announcementId, replyInput, sending]);

  return (
    <article
      className={styles.announcementCard}
      aria-label="Official announcement"
      data-announcement-id={announcementId ?? undefined}
    >
      <div className={styles.announcementHead}>
        <div className={styles.announcementAvatar} aria-hidden="true">SH</div>
        <div className={styles.announcementHeadText}>
          <div className={styles.announcementTitleRow}>
            <span className={styles.announcementName}>{senderName}</span>
            <span className={styles.announcementOfficialBadge}>
              <ShieldCheck size={12} color="currentColor" /> Official
            </span>
          </div>
          <span className={styles.announcementTime}>{time}</span>
        </div>
      </div>
      {title ? <p className={styles.announcementTitle}>{title}</p> : null}
      <p className={styles.announcementBody}>{body}</p>
      <AnnouncementLinkedPlugins linkedPlugins={linkedPlugins} />

      {announcementId ? (
        <AnnouncementEngagement
          announcementId={announcementId}
          reactions={reactions}
          onToggleReaction={onToggleReaction}
          threadOpen={threadOpen}
          localCount={localCount}
          onToggleThread={toggleThread}
          thread={{
            loading,
            loaded,
            replies,
            error,
            replyInput,
            sending,
            onReplyInputChange: setReplyInput,
            onSend: () => void sendReply(),
          }}
        />
      ) : null}
    </article>
  );
}
