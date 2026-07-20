'use client';

import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { FEED_REACTION_EMOJIS } from '../../lib/feed/constants';
import type { ChatMessage } from './shell-types';
import styles from './community-shell.module.css';

// Compact reaction row under a post/announcement: each emoji that has at least one reaction shows
// as a pill (emoji + count, highlighted when the member reacted), plus a small "add reaction"
// affordance that reveals the fixed quick set to pick from. Tapping a pill or a picker emoji toggles
// the reaction. Reused by peer chat bubbles, the gated contributor channel (with its own richer
// emoji set), and official announcement cards. `postId` is whatever id the caller's onToggle
// expects — a community post id for peer posts, an announcement id for announcements.
//
// `readOnly` renders the reactions others left as static pills with no "add reaction" affordance and
// no toggling. It is used on the member's OWN post: a member may only react to posts they did not
// author, so their own post shows the counts but offers no way to react. With nothing to show (no
// reactions and read-only) the row renders nothing at all.
export function ChatReactionRow({
  postId,
  reactions,
  onToggle,
  emojis = FEED_REACTION_EMOJIS,
  readOnly = false,
}: {
  postId: string;
  reactions: ChatMessage['reactions'];
  onToggle: (postId: string, emoji: string) => void;
  emojis?: readonly string[];
  readOnly?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const summaries = reactions ?? [];

  if (readOnly) {
    if (summaries.length === 0) {
      return null;
    }
    return (
      <div className={styles.chatReactionRow}>
        {summaries.map((reaction) => (
          <span
            key={reaction.emoji}
            className={`${styles.chatReactionPill} ${styles.chatReactionPillStatic}`}
            aria-label={`${reaction.emoji} reaction, ${reaction.count}`}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span className={styles.chatReactionCount}>{reaction.count}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.chatReactionRow}>
      {summaries.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          className={reaction.reactedByMe ? `${styles.chatReactionPill} ${styles.chatReactionPillActive}` : styles.chatReactionPill}
          onClick={() => onToggle(postId, reaction.emoji)}
          aria-pressed={reaction.reactedByMe}
          aria-label={`${reaction.emoji} reaction, ${reaction.count}${reaction.reactedByMe ? ', you reacted' : ''}`}
        >
          <span aria-hidden="true">{reaction.emoji}</span>
          <span className={styles.chatReactionCount}>{reaction.count}</span>
        </button>
      ))}

      <button
        type="button"
        className={styles.chatReactionAdd}
        onClick={() => setPickerOpen((open) => !open)}
        aria-expanded={pickerOpen}
        aria-label="Add a reaction"
      >
        <SmilePlus size={14} />
      </button>

      {pickerOpen ? (
        <div className={styles.chatReactionPicker} role="menu" aria-label="Pick a reaction">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={styles.chatReactionPickerBtn}
              onClick={() => {
                onToggle(postId, emoji);
                setPickerOpen(false);
              }}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
