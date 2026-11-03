'use client';

import { useState } from 'react';
import { SE_LIVE_ROOM_WORDS as W, seRoomSince, type SeRoomView } from '@ctf/shared';
import { SeRoomIcon } from '@/components/chyme/se-room/se-room-icon';
import styles from './rooms.module.css';

// The top of the live room, to the board "Live room": Back to Today, LIVE and since when, More;
// then which room and who it is for, the title, who hosts the talk and when, and the room rule,
// short until "Read it" opens it in place.

function RoomRule({ view }: { view: SeRoomView }) {
  const [open, setOpen] = useState(false);
  return (
    <p className={styles.rule}>
      {open ? view.rule : view.ruleShort}{' '}
      <button type="button" className={styles.ruleToggle} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? W.hideRule : W.readRule}
      </button>
    </p>
  );
}

function Eyebrow({ view }: { view: SeRoomView }) {
  if (!view.eyebrowName) return <span className={styles.audience}>{view.audience}</span>;
  return (
    <span className={styles.eyebrow}>
      {view.eyebrowName} <span className={styles.audience}>· {view.audience}</span>
    </span>
  );
}

export type SeRoomHeaderProps = {
  view: SeRoomView;
  live: boolean;
  startedAtIso: string | null;
  onBack: () => void;
  // Null until the room is read: the More sheet is drawn by the room.
  onMore: (() => void) | null;
  moreOpen: boolean;
};

export function SeRoomHeader({ view, live, startedAtIso, onBack, onMore, moreOpen }: SeRoomHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <button type="button" className={styles.round} aria-label={view.backLabel} title={view.backLabel} onClick={onBack}>
          <SeRoomIcon name="back" size={18} strokeWidth={2.2} />
        </button>
        {live ? <span className={styles.liveBadge}>{W.live}</span> : null}
        {live && startedAtIso ? <span className={styles.since}>{seRoomSince(startedAtIso)}</span> : null}
        <span className={styles.grow} />
        {onMore ? (
          <button type="button" className={styles.round} aria-label={W.more} title={W.more} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={onMore}>
            <SeRoomIcon name="more" size={18} />
          </button>
        ) : null}
      </div>
      <div className={styles.titles}>
        <Eyebrow view={view} />
        <h1 className={styles.title}>{view.heading}</h1>
        {view.talkLine ? <p className={styles.meta}>{view.talkLine}</p> : null}
        <RoomRule view={view} />
      </div>
    </header>
  );
}
