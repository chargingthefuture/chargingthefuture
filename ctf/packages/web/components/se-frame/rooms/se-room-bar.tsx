'use client';

import { SE_LIVE_ROOM_WORDS as W, seRoomWords } from '@ctf/shared';
import { SeAvatar } from '@/components/shared/se-avatar';
import { SeRoomIcon } from '@/components/chyme/se-room/se-room-icon';
import { useSeRooms } from './se-rooms';
import styles from './rooms.module.css';

// The room in the call, while the member is somewhere else in the app, to the board "Room bar
// while browsing": who is speaking, the talk's title, who speaks and that the member listens,
// Raise hand and Leave quietly. Tapping the title opens the room again.
export function SeRoomBar() {
  const { opened, shown, summaries, open, leave, toggleHand } = useSeRooms();
  const scope = opened.find((item) => summaries[item]?.joined && item !== shown);
  const summary = scope ? summaries[scope] : undefined;
  if (!scope || !summary) return null;
  const words = seRoomWords(scope);
  const handLabel = summary.handRaised ? W.lowerHand : W.raiseHand;
  return (
    <section className={styles.bar} aria-label="Room you are in">
      {summary.faces.length > 0 ? (
        <span className={styles.barFaces} aria-hidden="true">
          {summary.faces.map((id) => (
            <span key={id} className={styles.barFace}>
              <SeAvatar accountId={id} size={30} />
            </span>
          ))}
        </span>
      ) : null}
      <button type="button" className={styles.barOpen} onClick={() => open(scope)}>
        <span className={styles.barName}>{summary.title}</span>
        <span className={styles.barLine}>{summary.line}</span>
      </button>
      {summary.canRaiseHand ? (
        <button type="button" className={styles.barHand} aria-label={handLabel} title={handLabel} aria-pressed={summary.handRaised} onClick={() => toggleHand(scope)}>
          <SeRoomIcon name="hand" size={18} />
        </button>
      ) : null}
      <button type="button" className={styles.barLeave} aria-label={words.leave} title={words.leave} onClick={() => leave(scope)}>
        <SeRoomIcon name="close" size={16} strokeWidth={2.4} />
      </button>
    </section>
  );
}
