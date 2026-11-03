'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AddToCalendarButton } from '@/components/shared/add-to-calendar';
import {
  SE_TODAY_ROOM_WORDS as W,
  seRoomCountsLine,
  seTalkCalendarEvent,
  seTalkHostLine,
  seWeaversLine,
  type SeTodayBroadcast,
  type SeTodayRoom,
} from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import { useSeRooms } from '../rooms/se-rooms';
import styles from './today.module.css';

// The rooms at the top of Today, to the approved board: the Main Room card with its talk, who hosts
// it and when, the faces on the stage, Listen in and Bring someone in; and Weavers of the Commons as
// one row for the members who may enter it. The broadcast card sits above them while the System
// Architect is live.

export function BroadcastCard({ broadcast }: { broadcast: SeTodayBroadcast }) {
  return (
    <section aria-label="Live broadcast" className={styles.roomCard}>
      <div className={styles.roomHead}>
        <span className={styles.liveBadge}>LIVE</span>
        <span className={styles.roomName}>Broadcast</span>
      </div>
      {broadcast.title ? <span className={styles.roomTitle}>{broadcast.title}</span> : null}
      <Link href={broadcast.href} className={styles.primaryButton}>
        Watch now
      </Link>
    </section>
  );
}

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

// "Bring someone in" shares the signed-out Today, where anybody can listen without an account: the
// phone's share sheet where there is one, the clipboard otherwise.
function useBringSomeoneIn() {
  const [note, setNote] = useState<string | null>(null);
  const bring = async () => {
    const url = `${window.location.origin}${W.bringPath}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: W.bringText, url });
        return;
      }
      await navigator.clipboard.writeText(`${W.bringText} ${url}`);
      setNote(W.copied);
    } catch (error) {
      // A share sheet closed without sharing is not a failure; anything else is said on the card.
      if ((error as { name?: string } | null)?.name !== 'AbortError') setNote(W.copyFailed);
    }
  };
  return { note, bring };
}

function MainRoomCard({ room }: { room: SeTodayRoom }) {
  const { open } = useSeRooms();
  const { note, bring } = useBringSomeoneIn();
  const talk = room.nextTalk;
  return (
    <section aria-label={room.live ? 'Live room' : room.name} className={styles.roomCard}>
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
      <div className={styles.roomButtons}>
        <button type="button" className={`${styles.primaryButton} ${styles.grow}`} onClick={() => open('main', talk)}>
          {W.listen}
        </button>
        <button type="button" className={styles.quietButton} onClick={() => void bring()}>
          {W.bring}
        </button>
      </div>
      {note ? (
        <p role="status" className={styles.roomMeta}>
          {note}
        </p>
      ) : null}
    </section>
  );
}

function WeaversRow({ room }: { room: SeTodayRoom }) {
  const { open } = useSeRooms();
  return (
    <section aria-label={`${room.name} room`} className={styles.weavers}>
      <span className={styles.lock} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <span className={styles.weaversText}>
        <span className={styles.roomName}>{room.name}</span>
        <span className={styles.weaversLine}>{seWeaversLine(room)}</span>
      </span>
      <button type="button" className={styles.quietButton} onClick={() => open('contributors', null)}>
        {W.open}
      </button>
    </section>
  );
}

// Opens the room inside the frame, so the call keeps running while the member reads Today.
export function RoomCard({ room }: { room: SeTodayRoom }) {
  return room.key === 'weavers' ? <WeaversRow room={room} /> : <MainRoomCard room={room} />;
}
