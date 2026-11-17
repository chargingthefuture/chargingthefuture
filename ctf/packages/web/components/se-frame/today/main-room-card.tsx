'use client';

import type { ReactNode } from 'react';
import { AddToCalendarButton } from '@/components/shared/add-to-calendar';
import {
  SE_MAIN_ROOM_CARD_WORDS as M,
  SE_TODAY_ROOM_WORDS as W,
  seRoomCountsLine,
  seTalkCalendarEvent,
  seTalkHostLine,
  type SeMainRoomButtons,
  type SeTodayRoom,
} from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import styles from './today.module.css';

// The Main Room card on Today, one card signed in and signed out (owner decision, 2026-11-17): the
// room's name and audience, the next talk with its host, time and Add to calendar, the faces and
// counts ("Quiet right now" when nobody is in), then two buttons whose words come from
// seMainRoomButtons. A visitor's second button is a link to sign-up; `inPlace` is what a visitor
// hears in the card itself (the readings, or the live room), shown where the first button was.

function Faces({ faces }: { faces: string[] }) {
  if (faces.length === 0) return null;
  return (
    <span className={styles.faces} aria-hidden="true">
      {faces.map((id) => (
        <span key={id} className={styles.face}>
          <SeAvatar accountId={id} size={30} />
        </span>
      ))}
    </span>
  );
}

type MainRoomCardProps = {
  room: SeTodayRoom;
  buttons: SeMainRoomButtons;
  onPrimary: () => void;
  // Signed in: the second button's action. Signed out: where it leads.
  onSecondary?: () => void;
  signUpUrl?: string;
  inPlace?: ReactNode;
  note?: string | null;
};

function Secondary({ label, onSecondary, signUpUrl }: { label: string; onSecondary?: () => void; signUpUrl?: string }) {
  if (signUpUrl) {
    return (
      <a href={signUpUrl} className={styles.quietButton}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={styles.quietButton} onClick={onSecondary}>
      {label}
    </button>
  );
}

export function MainRoomCard({ room, buttons, onPrimary, onSecondary, signUpUrl, inPlace, note }: MainRoomCardProps) {
  const talk = room.nextTalk;
  return (
    <section aria-label={room.live ? M.liveLabel : room.name} className={styles.roomCard}>
      <div className={styles.roomHead}>
        {room.live ? <span className={styles.liveBadge}>LIVE</span> : null}
        <span className={styles.roomName}>{room.name}</span>
        <span className={styles.roomMeta}>· {W.mainAudience}</span>
      </div>
      {talk ? <span className={styles.roomTitle}>{talk.title}</span> : null}
      {talk ? <span className={styles.roomMeta}>{seTalkHostLine(talk)}</span> : null}
      {talk && !talk.onAir ? (
        <AddToCalendarButton color="var(--se-ink)" borderColor="var(--se-line)" event={seTalkCalendarEvent(talk)} style={{ alignSelf: 'flex-start' }} />
      ) : null}
      <div className={styles.stageRow}>
        <Faces faces={room.faces} />
        <span className={styles.roomMeta}>{seRoomCountsLine(room)}</span>
      </div>
      {inPlace}
      <div className={styles.roomButtons}>
        {inPlace ? null : (
          <button type="button" className={`${styles.primaryButton} ${styles.grow}`} onClick={onPrimary}>
            {buttons.primary.label}
          </button>
        )}
        <Secondary label={buttons.secondary.label} onSecondary={onSecondary} signUpUrl={signUpUrl} />
      </div>
      {note ? (
        <p role="status" className={styles.roomMeta}>
          {note}
        </p>
      ) : null}
    </section>
  );
}
