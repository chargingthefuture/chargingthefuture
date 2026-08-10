'use client';

import Link from 'next/link';
import { ShieldCheck, ArrowUpRight, MessageCircle, Pencil, Send, Trash2 } from 'lucide-react';
import type { CommonsAnnouncementReply } from '../../lib/commons/types';
import { FEED_MAX_COMMUNITY_REPLY_LENGTH } from '../../lib/feed/constants';
import type { ChatReactionSummary } from './shell-types';
import { ChatReactionRow } from './chat-reaction-row';
import styles from './community-shell.module.css';
import { NoticeParagraphs } from './notice-paragraphs';
import { useAnnouncementReplies, type AnnouncementRepliesState } from './use-announcement-replies';

type AnnouncementCardProps = {
  // Who posted it — the operator's name for an official announcement. Passed in so the card matches
  // whatever label the stream resolved rather than hardcoding it. Whether the post is official is
  // carried by the shield badge, not by this name.
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

// The member's own controls on their own reply: rewrite the words, or take the reply down. Shown
// only on `isMine` replies — the route enforces the same thing, this just does not offer what would
// be refused. A moderator taking someone else's reply down does it from the Commons moderation
// screen, where the removal is reversible.
function AnnouncementReplyOwnerActions({
  reply,
  state,
}: {
  reply: CommonsAnnouncementReply;
  state: AnnouncementRepliesState;
}) {
  const busy = state.busyReplyId === reply.id;
  return (
    <span className={styles.announcementReplyOwnerActions}>
      <button
        type="button"
        className={styles.announcementReplyAction}
        onClick={() => state.startEdit(reply)}
        disabled={busy}
      >
        <Pencil size={11} /> Edit
      </button>
      <button
        type="button"
        className={`${styles.announcementReplyAction} ${styles.announcementReplyActionDanger}`}
        onClick={() => state.deleteReply(reply)}
        disabled={busy}
      >
        <Trash2 size={11} /> Delete
      </button>
    </span>
  );
}

// The reply turned into an editor. Same input rules as the composer, so an edit cannot become a way
// to post something a fresh reply would have been refused.
function AnnouncementReplyEditor({ reply, state }: { reply: CommonsAnnouncementReply; state: AnnouncementRepliesState }) {
  const busy = state.busyReplyId === reply.id;
  const canSave = state.editInput.trim().length > 0 && !busy;
  return (
    <div className={styles.announcementReplyEditor}>
      <textarea
        className={styles.announcementReplyInput}
        rows={2}
        value={state.editInput}
        maxLength={FEED_MAX_COMMUNITY_REPLY_LENGTH}
        onChange={(event) => state.setEditInput(event.target.value)}
        aria-label="Edit your reply"
      />
      <div className={styles.announcementReplyEditorActions}>
        <button
          type="button"
          className={styles.announcementReplyAction}
          onClick={state.cancelEdit}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.announcementReplyAction} ${styles.announcementReplyActionPrimary}`}
          onClick={state.saveEdit}
          disabled={!canSave}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// A single reply within the thread — the member's own reply also carries its edit/delete controls.
function AnnouncementReplyItem({ reply, state }: { reply: CommonsAnnouncementReply; state: AnnouncementRepliesState }) {
  const editing = state.editingId === reply.id;
  return (
    <div className={styles.announcementReply}>
      <div className={styles.announcementReplyMeta}>
        <span className={styles.announcementReplyAuthor}>{reply.isMine ? 'You' : reply.author}</span>
        <span className={styles.announcementReplyTime}>
          {formatReplyTime(reply.sentAtIso)}
          {/* Said plainly rather than by silently swapping the words: a reply whose text changed
              after it was posted should not read as the original. */}
          {reply.editedAtIso ? ' · edited' : ''}
        </span>
        {reply.isMine && !editing ? <AnnouncementReplyOwnerActions reply={reply} state={state} /> : null}
      </div>
      {editing ? (
        <AnnouncementReplyEditor reply={reply} state={state} />
      ) : (
        <p className={styles.announcementReplyBody}>{reply.body}</p>
      )}
    </div>
  );
}

// The expanded reply thread: loading/empty notes, the list of replies, an error line, and the
// composer. Loaded on demand when the thread is first opened.
function AnnouncementThread({ state }: { state: AnnouncementRepliesState }) {
  const showEmpty = !state.loading && state.loaded && state.replies.length === 0;
  const canSend = state.replyInput.trim().length > 0;
  const sendClassName = canSend
    ? `${styles.announcementReplySend} ${styles.announcementReplySendActive}`
    : styles.announcementReplySend;
  return (
    <div className={styles.announcementThread}>
      {state.loading ? <p className={styles.announcementThreadNote}>Loading replies…</p> : null}
      {showEmpty ? (
        <p className={styles.announcementThreadNote}>No replies yet. Be the first to reply.</p>
      ) : null}
      {state.replies.map((reply) => (
        <AnnouncementReplyItem key={reply.id} reply={reply} state={state} />
      ))}

      {state.error ? <p className={styles.announcementThreadError} role="status">{state.error}</p> : null}

      <div className={styles.announcementReplyComposer}>
        <textarea
          className={styles.announcementReplyInput}
          placeholder="Write a reply…"
          rows={1}
          value={state.replyInput}
          maxLength={FEED_MAX_COMMUNITY_REPLY_LENGTH}
          onChange={(event) => state.setReplyInput(event.target.value)}
          // Enter inserts a line break, it does not send — matches the main composer (owner
          // request 2026-07-20). Sending is only via the send button.
        />
        <button
          type="button"
          className={sendClassName}
          onClick={state.sendReply}
          disabled={state.sending || !canSend}
          aria-label="Post reply"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// The reaction row plus the reply toggle, and the thread itself when open.
function AnnouncementEngagement({
  announcementId,
  reactions,
  onToggleReaction,
  state,
}: {
  announcementId: string;
  reactions?: ChatReactionSummary[];
  onToggleReaction?: (announcementId: string, emoji: string) => void;
  state: AnnouncementRepliesState;
}) {
  const replyLabel = formatReplyLabel(state.localCount);
  const toggleClassName = state.threadOpen
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
          onClick={state.toggleThread}
          aria-expanded={state.threadOpen}
          aria-label={state.threadOpen ? 'Hide replies' : `Show replies (${state.localCount})`}
        >
          <MessageCircle size={13} /> {replyLabel}
        </button>
      </div>

      {state.threadOpen ? <AnnouncementThread state={state} /> : null}
    </div>
  );
}

// First letter of whoever posted the announcement, for the card's round avatar.
function announcementAvatarGlyph(senderName: string): string {
  const trimmed = senderName.trim();
  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return handle.charAt(0).toUpperCase() || '?';
}

// Official announcement, rendered as a distinct card (emerald treatment, shield
// "Official" badge) so it stands out from peer chat bubbles and AI answers instead of blending into
// the purple stream. Members can react to an announcement with the same fixed emoji quick set as a
// peer post, and reply to it — the replies group under the announcement as a thread (loaded on
// demand when the thread is opened). A member can rewrite or delete their own reply; nobody can
// change anyone else's.
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
  const replyState = useAnnouncementReplies(announcementId, replyCount ?? 0);

  return (
    <article
      className={styles.announcementCard}
      aria-label="Official announcement"
      data-announcement-id={announcementId ?? undefined}
    >
      <div className={styles.announcementHead}>
        {/* Derived from the sender's name rather than a fixed pair of letters, so the avatar can
            never disagree with the name printed beside it (it used to read a hardcoded "SH"). */}
        <div className={styles.announcementAvatar} aria-hidden="true">{announcementAvatarGlyph(senderName)}</div>
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
      {/* Real paragraphs, not one pre-wrap blob. A body that was source-wrapped when it was authored
          would otherwise render with hard breaks mid-sentence — which is exactly what reached members
          once. NoticeParagraphs collapses those soft wraps while keeping a deliberate line list (the
          trailing "Open <Plugin>: <url>" block) on separate lines. */}
      <NoticeParagraphs body={body} className={styles.announcementBody} />
      <AnnouncementLinkedPlugins linkedPlugins={linkedPlugins} />

      {announcementId ? (
        <AnnouncementEngagement
          announcementId={announcementId}
          reactions={reactions}
          onToggleReaction={onToggleReaction}
          state={replyState}
        />
      ) : null}
    </article>
  );
}
