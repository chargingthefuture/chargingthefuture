'use client';

import Link from 'next/link';
import { AddToCalendarButton, talkCalendarEvent } from '@/components/shared/add-to-calendar';
import {
  SE_ROOM_MAIN_AUDIENCE,
  SE_ROOM_WEAVERS_AUDIENCE,
  SE_ROOM_WORDS_MAIN,
  seRoomPeopleLine,
  seTalkLine,
  type SeTodayBroadcast,
  type SeTodayRoom,
} from '@ctf/shared';
import { useSeRooms } from '../rooms/se-rooms';
import styles from './today.module.css';

// The rooms at the top of Today (the Main Room, and Weavers of the Commons for the members who may
// enter it), and the broadcast card above them while the System Architect is live.

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

const AUDIENCE: Record<SeTodayRoom['key'], string> = { main: SE_ROOM_MAIN_AUDIENCE, weavers: SE_ROOM_WEAVERS_AUDIENCE };

// Opens the room inside the frame, so the call keeps running while the member reads Today.
export function RoomCard({ room }: { room: SeTodayRoom }) {
  const { open } = useSeRooms();
  const talkLine = seTalkLine(room.nextTalk);
  const scope = room.key === 'weavers' ? 'contributors' : 'main';
  return (
    <section aria-label={room.name} className={styles.roomCard}>
      <div className={styles.roomHead}>
        {room.live ? <span className={styles.liveBadge}>LIVE</span> : null}
        <span className={styles.roomName}>{room.name}</span>
        <span className={styles.roomMeta}>· {AUDIENCE[room.key]}</span>
      </div>
      {talkLine ? <span className={styles.roomTitle}>{talkLine}</span> : null}
      {room.nextTalk && !room.nextTalk.onAir ? (
        <AddToCalendarButton color="var(--se-ink)" borderColor="var(--se-line)" event={talkCalendarEvent(room.nextTalk)} style={{ alignSelf: 'flex-start' }} />
      ) : null}
      <span className={styles.roomMeta}>{seRoomPeopleLine(room.members, room.guests)}</span>
      <button type="button" className={styles.primaryButton} onClick={() => open(scope, room.nextTalk)}>
        {room.live ? SE_ROOM_WORDS_MAIN.join : 'Open the room'}
      </button>
    </section>
  );
}
