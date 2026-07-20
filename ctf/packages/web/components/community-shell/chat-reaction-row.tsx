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
// emoji set), and official announcement cards. `targetId` is whatever id the caller's onToggle
// expects — a community post id for peer posts, an announcement id for announcements.
export function ChatReactionRow({
  postId,
  reactions,
  onToggle,
  emojis = FEED_REACTION_EMOJIS,
}: {
  postId: string;
  reactions: ChatMessage['reactions'];
  onToggle: (postId: string, emoji: string) => void;
  emojis?: readonly string[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const summaries = reactions ?? [];

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
