'use client';

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { Eye, Pencil, Reply, Trash2, X } from 'lucide-react';
import {
  GATED_CHANNEL_DISPLAY_NAME,
  GATED_CHANNEL_MODERATOR_DISCLOSURE,
  GATED_MAX_MESSAGE_LENGTH,
  GATED_REACTION_EMOJIS,
} from '../../lib/contributor-access/gated-channel-shared';
import type { ShellCurrentUser } from './shell-types';
import { ChatReactionRow } from './chat-reaction-row';
import { useGatedChat, type GatedChatMessage } from './use-gated-chat';
import styles from './community-shell.module.css';

// Gated contributor channel panel. Reuses the Commons chat design (same CSS module, same row and
// reaction components) with the gated differences: the moderator-read disclosure in the header,
// the richer reaction set, Signal-style threaded replies, and the longer message limit. There is
// deliberately NO image/file upload affordance anywhere in this panel — uploads are also disabled
// on the Stream channel type — and no AI assistant or concierge (those are Commons features).

type QuotedMessage = NonNullable<GatedChatMessage['quotedMessage']>;

// Class-name pickers for the two-sided bubble layout (the member's own posts sit on the right with
// the "user" variant classes; peers on the left). Hoisted so the repeated `from === 'user'` ternary
// lives in one place instead of being inlined at every element.
const rowClassName = (fromUser: boolean) =>
  fromUser ? `${styles.chatRow} ${styles.chatRowUser}` : styles.chatRow;
const senderClassName = (fromUser: boolean) =>
  fromUser ? `${styles.chatSender} ${styles.chatSenderUser}` : styles.chatSender;
const bubbleClassName = (fromUser: boolean) =>
  fromUser ? `${styles.chatBubble} ${styles.chatBubbleUser}` : `${styles.chatBubble} ${styles.chatBubbleHub}`;
const metaRowClassName = (fromUser: boolean) =>
  fromUser ? `${styles.chatMetaRow} ${styles.chatMetaRowUser}` : styles.chatMetaRow;
const timeClassName = (fromUser: boolean) =>
  fromUser ? `${styles.chatTime} ${styles.chatTimeUser}` : styles.chatTime;

// First letter of the sender's handle for the peer avatar, falling back to 'C' when empty.
function avatarInitial(senderLabel: string): string {
  return senderLabel.replace(/^@/, '').charAt(0).toUpperCase() || 'C';
}

function deleteAriaLabel(fromUser: boolean, senderLabel: string): string {
  return fromUser ? 'Delete your message' : `Delete message from ${senderLabel}`;
}

// Confirm before removing a post (destructive, no undo) — same prompt as the Commons.
function requestDeleteMessage(
  deleteMessage: (postId: string) => void | Promise<void>,
  postId: string,
) {
  if (window.confirm('Delete this message? This cannot be undone. To change it, delete and post again.')) {
    void deleteMessage(postId);
  }
}

type GatedChatPanelProps = {
  currentUser: ShellCurrentUser;
  // Admins may delete ANY post (the moderator power the in-channel disclosure line discloses);
  // members only their own. The server enforces this again — the flag only shows the affordance.
  isAdmin?: boolean;
};

function PeerAvatar({ senderLabel }: { senderLabel: string }) {
  return (
    <div className={styles.chatAvatar} aria-hidden="true">
      {avatarInitial(senderLabel)}
    </div>
  );
}

// The quoted-reply block above a threaded message. When the original post is still on screen the
// block is a button that jumps to it; otherwise (original deleted/out of range) it is a static block.
function QuotedReplyBlock({ quoted, onJump }: { quoted: QuotedMessage; onJump: (postId: string) => void }) {
  const author = <span className={styles.chatQuotedAuthor}>{quoted.author}</span>;
  const snippet = <span className={styles.chatQuotedSnippet}>{quoted.snippet}</span>;
  if (!quoted.postId) {
    return (
      <div className={styles.chatQuotedBlock}>
        {author}
        {snippet}
      </div>
    );
  }
  const postId = quoted.postId;
  return (
    <button
      type="button"
      className={`${styles.chatQuotedBlock} ${styles.chatQuotedBlockClickable}`}
      onClick={() => onJump(postId)}
      aria-label={`Go to the message from ${quoted.author} that this replies to`}
    >
      {author}
      {snippet}
    </button>
  );
}

function EditButton({ onEdit }: { onEdit: () => void }) {
  return (
    <button type="button" className={styles.chatEditBtn} onClick={onEdit} aria-label="Edit your message">
      <Pencil size={12} /> Edit
    </button>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button type="button" className={styles.chatDeleteBtn} onClick={onDelete} aria-label={label}>
      <Trash2 size={12} /> Delete
    </button>
  );
}

// The row of controls under a bubble: timestamp, reply, and (for the member's own posts, or any post
// when the viewer is an admin) edit/delete.
function MessageMetaRow({
  msg,
  fromUser,
  isAdmin,
  onBeginReply,
  onEdit,
  onDelete,
}: {
  msg: GatedChatMessage;
  fromUser: boolean;
  isAdmin: boolean;
  onBeginReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={metaRowClassName(fromUser)}>
      <span className={timeClassName(fromUser)}>{msg.timeLabel}</span>
      <button
        type="button"
        className={styles.chatReplyBtn}
        onClick={onBeginReply}
        aria-label={`Reply to ${msg.senderLabel}`}
      >
        <Reply size={12} /> Reply
      </button>
      {fromUser ? <EditButton onEdit={onEdit} /> : null}
      {fromUser || isAdmin ? (
        <DeleteButton label={deleteAriaLabel(fromUser, msg.senderLabel)} onDelete={onDelete} />
      ) : null}
    </div>
  );
}

// One full chat message: peer avatar (peers only), sender label, optional quoted reply, the bubble,
// the meta/controls row, and the reaction row.
function GatedMessageRow({
  msg,
  isAdmin,
  inputRef,
  onBeginReply,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onJumpToQuoted,
}: {
  msg: GatedChatMessage;
  isAdmin: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onBeginReply: (msg: GatedChatMessage) => void;
  onEditMessage: (postId: string, text: string) => void;
  onDeleteMessage: (postId: string) => void | Promise<void>;
  onToggleReaction: (postId: string, emoji: string) => void;
  onJumpToQuoted: (postId: string) => void;
}) {
  const fromUser = msg.from === 'user';

  const handleEdit = () => {
    // Editing is delete + repost: pull the text into the composer, delete the original,
    // and focus the box so the member fixes it and sends a fresh message.
    onEditMessage(msg.id, msg.text);
    inputRef.current?.focus();
  };
  const handleDelete = () => requestDeleteMessage(onDeleteMessage, msg.id);

  return (
    <div className={rowClassName(fromUser)}>
      {msg.from === 'peer' ? <PeerAvatar senderLabel={msg.senderLabel} /> : null}
      <div className={styles.chatBubbleGroup} data-post-id={msg.id}>
        <span className={senderClassName(fromUser)}>{msg.senderLabel}</span>
        {msg.quotedMessage ? <QuotedReplyBlock quoted={msg.quotedMessage} onJump={onJumpToQuoted} /> : null}
        <div className={bubbleClassName(fromUser)}>{msg.text}</div>
        <MessageMetaRow
          msg={msg}
          fromUser={fromUser}
          isAdmin={isAdmin}
          onBeginReply={() => onBeginReply(msg)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <ChatReactionRow
          postId={msg.id}
          reactions={msg.reactions}
          onToggle={(postId, emoji) => void onToggleReaction(postId, emoji)}
          emojis={GATED_REACTION_EMOJIS}
        />
      </div>
    </div>
  );
}

// The loading footnote and the empty-channel hub bubble. Mutually exclusive with a populated list,
// so this renders one of them (or nothing) exactly as the two sequential conditionals used to.
function ChatMessagesPlaceholder({ isLoading, messageCount }: { isLoading: boolean; messageCount: number }) {
  if (isLoading && messageCount === 0) {
    return <p className={styles.chatFootnote}>Loading channel messages…</p>;
  }
  if (!isLoading && messageCount === 0) {
    return (
      <div className={styles.chatBubbleGroup}>
        <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
          This is the contributor channel. Threads, a wider reaction set, and longer messages — start
          the first conversation.
        </div>
      </div>
    );
  }
  return null;
}

export function GatedChatPanel({ currentUser, isAdmin = false }: GatedChatPanelProps) {
  const {
    messages,
    input,
    setInput,
    notifyTyping,
    typingUsers,
    replyTarget,
    beginReply,
    cancelReply,
    sendMessage,
    toggleReaction,
    deleteMessage,
    editMessage,
    isLoading,
    isSending,
    error,
  } = useGatedChat(currentUser);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Tapping a quoted-reply block jumps to the original message (same behavior as the Commons):
  // find the rendered bubble with that post id, scroll it into view, and flash a highlight.
  const jumpToQuotedPost = useCallback((postId: string | null) => {
    if (!postId) return;
    const container = messagesContainerRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-post-id="${postId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add(styles.chatBubbleFlash);
    window.setTimeout(() => target.classList.remove(styles.chatBubbleFlash), 1600);
  }, []);

  // Auto-grow the composer as the member types (same behavior as the Commons composer).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const typingLabel = useMemo<string | null>(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing…`;
    if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing…`;
    return `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing…`;
  }, [typingUsers]);

  return (
    <div className={styles.chatPanelWrap}>
      {/* Channel header. The moderator-read disclosure is a hard requirement (proposal section 2):
          it must be plainly visible in the channel, so it lives here in the header, always. */}
      <div className={styles.gatedHeader}>
        <p className={styles.gatedHeaderTitle}>{GATED_CHANNEL_DISPLAY_NAME}</p>
        <p className={styles.gatedHeaderSub}>
          The contributor channel — earned through steady, broad participation. The &quot;material value
          first&quot; norm applies here too.
        </p>
        <p className={styles.gatedHeaderNote}>
          <Eye size={12} aria-hidden="true" /> {GATED_CHANNEL_MODERATOR_DISCLOSURE}
        </p>
      </div>

      {error ? (
        <section className={styles.usernameAlert} role="status">
          {error}
        </section>
      ) : null}

      <div className={styles.chatMessages} ref={messagesContainerRef}>
        <ChatMessagesPlaceholder isLoading={isLoading} messageCount={messages.length} />

        {messages.map((msg) => (
          <GatedMessageRow
            key={msg.id}
            msg={msg}
            isAdmin={isAdmin}
            inputRef={inputRef}
            onBeginReply={beginReply}
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
            onToggleReaction={toggleReaction}
            onJumpToQuoted={jumpToQuotedPost}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {replyTarget ? (
        <div className={styles.composerReplyBanner}>
          <div className={styles.composerReplyPreview}>
            <span className={styles.composerReplyLabel}>Replying to {replyTarget.quote.author}</span>
            <span className={styles.composerReplySnippet}>{replyTarget.quote.snippet}</span>
          </div>
          <button type="button" className={styles.composerReplyCancel} onClick={cancelReply} aria-label="Cancel reply">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {typingLabel ? (
        <div className={styles.typingIndicator} role="status" aria-live="polite">
          <span className={styles.typingDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {typingLabel}
        </div>
      ) : null}

      <div className={styles.chatInputWrap}>
        <label className={styles.visuallyHidden} htmlFor="gated-chat-input">
          Write to the contributor channel
        </label>
        <textarea
          ref={inputRef}
          id="gated-chat-input"
          className={styles.chatInput}
          placeholder="Write to the contributor channel…"
          rows={1}
          maxLength={GATED_MAX_MESSAGE_LENGTH}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            notifyTyping();
          }}
          // Enter inserts a line break, it does not send — matches the main composer (owner request
          // 2026-07-20). Sending is only via the send button.
        />
        <button
          type="button"
          className={input.trim() ? `${styles.chatSendBtn} ${styles.chatSendBtnActive}` : styles.chatSendBtn}
          onClick={() => {
            void sendMessage();
          }}
          aria-label="Send message"
          disabled={isSending}
        >
          ➤
        </button>
      </div>

      <p className={styles.chatFootnote}>
        {GATED_CHANNEL_MODERATOR_DISCLOSURE} No images here — text only.{' '}
        <a href="/guidelines" style={{ color: 'inherit', textDecoration: 'underline' }}>Community guidelines</a>
      </p>
    </div>
  );
}
