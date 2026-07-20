'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Eye, Reply, Trash2, X } from 'lucide-react';
import {
  GATED_CHANNEL_DISPLAY_NAME,
  GATED_CHANNEL_MODERATOR_DISCLOSURE,
  GATED_MAX_MESSAGE_LENGTH,
  GATED_REACTION_EMOJIS,
} from '../../lib/contributor-access/gated-channel-shared';
import type { ShellCurrentUser } from './shell-types';
import { ChatReactionRow } from './chat-reaction-row';
import { useGatedChat } from './use-gated-chat';
import styles from './community-shell.module.css';

// Gated contributor channel panel. Reuses the Commons chat design (same CSS module, same row and
// reaction components) with the gated differences: the moderator-read disclosure in the header,
// the richer reaction set, Signal-style threaded replies, and the longer message limit. There is
// deliberately NO image/file upload affordance anywhere in this panel — uploads are also disabled
// on the Stream channel type — and no AI assistant or concierge (those are Commons features).

type GatedChatPanelProps = {
  currentUser: ShellCurrentUser;
  // Admins may delete ANY post (the moderator power the in-channel disclosure line discloses);
  // members only their own. The server enforces this again — the flag only shows the affordance.
  isAdmin?: boolean;
};

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
    isLoading,
    isSending,
    error,
  } = useGatedChat(currentUser);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

      <div className={styles.chatMessages}>
        {isLoading && messages.length === 0 ? (
          <p className={styles.chatFootnote}>Loading channel messages…</p>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <div className={styles.chatBubbleGroup}>
            <div className={`${styles.chatBubble} ${styles.chatBubbleHub}`}>
              This is the contributor channel. Threads, a wider reaction set, and longer messages — start
              the first conversation.
            </div>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div key={msg.id} className={msg.from === 'user' ? `${styles.chatRow} ${styles.chatRowUser}` : styles.chatRow}>
            {msg.from === 'peer' ? (
              <div className={styles.chatAvatar} aria-hidden="true">
                {msg.senderLabel.replace(/^@/, '').charAt(0).toUpperCase() || 'C'}
              </div>
            ) : null}
            <div className={styles.chatBubbleGroup}>
              <span className={msg.from === 'user' ? `${styles.chatSender} ${styles.chatSenderUser}` : styles.chatSender}>
                {msg.senderLabel}
              </span>
              {msg.quotedMessage ? (
                <div className={styles.chatQuotedBlock}>
                  <span className={styles.chatQuotedAuthor}>{msg.quotedMessage.author}</span>
                  <span className={styles.chatQuotedSnippet}>{msg.quotedMessage.snippet}</span>
                </div>
              ) : null}
              <div className={msg.from === 'user' ? `${styles.chatBubble} ${styles.chatBubbleUser}` : `${styles.chatBubble} ${styles.chatBubbleHub}`}>
                {msg.text}
              </div>
              <div className={msg.from === 'user' ? `${styles.chatMetaRow} ${styles.chatMetaRowUser}` : styles.chatMetaRow}>
                <span className={msg.from === 'user' ? `${styles.chatTime} ${styles.chatTimeUser}` : styles.chatTime}>
                  {msg.timeLabel}
                </span>
                <button
                  type="button"
                  className={styles.chatReplyBtn}
                  onClick={() => beginReply(msg)}
                  aria-label={`Reply to ${msg.senderLabel}`}
                >
                  <Reply size={12} /> Reply
                </button>
                {msg.from === 'user' || isAdmin ? (
                  <button
                    type="button"
                    className={styles.chatDeleteBtn}
                    onClick={() => {
                      if (window.confirm('Delete this message? This cannot be undone. To change it, delete and post again.')) {
                        void deleteMessage(msg.id);
                      }
                    }}
                    aria-label={msg.from === 'user' ? 'Delete your message' : `Delete message from ${msg.senderLabel}`}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                ) : null}
              </div>
              <ChatReactionRow
                postId={msg.id}
                reactions={msg.reactions}
                onToggle={(postId, emoji) => void toggleReaction(postId, emoji)}
                emojis={GATED_REACTION_EMOJIS}
              />
            </div>
          </div>
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
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
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
