'use client';

import Link from 'next/link';
import { AddToCalendarButton } from '@/components/shared/add-to-calendar';
import {
  SE_BROADCAST_WORDS as B,
  SE_TODAY_ROOM_WORDS as W,
  seBroadcastHostLine,
  seRoomCountsLine,
  seTalkCalendarEvent,
  seTalkHostLine,
  seWeaversLine,
  type SeTodayBroadcast,
  type SeTodayRoom,
} from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import { useBringSomeoneIn } from '../../shared/use-bring-someone-in';
import { useSeRooms } from '../rooms/se-rooms';
import styles from './today.module.css';

// The rooms at the top of Today, to the approved board: the Main Room card with its talk, who hosts
// it and when, the faces on the stage, Listen in and Bring someone in; and Weavers of the Commons as
// one row for the members who may enter it. The broadcast card sits above them while the System
// Architect is live.

// The broadcast card (approved board "Broadcast cards on Today"): the picture area with LIVE and a
// play button, then who is broadcasting and since when, Watch, and Chat (the chat sits beside the
// player on the broadcast page). No watcher count: viewers watch the public stream without joining
// the call, so nothing counts them.
export function BroadcastCard({ broadcast }: { broadcast: SeTodayBroadcast }) {
  const hostLine = seBroadcastHostLine(broadcast);
  return (
    <section aria-label="Live broadcast" className={styles.broadcastCard}>
      <Link href={broadcast.href} className={styles.broadcastPicture} aria-label={`${B.watch}: ${broadcast.title ?? B.label}`}>
        <span className={`${styles.liveBadge} ${styles.broadcastLive}`}>LIVE</span>
        <span className={styles.broadcastPlay} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5l12 7-12 7z" />
          </svg>
        </span>
      </Link>
      <div className={styles.broadcastBody}>
        <span className={styles.broadcastLabel}>{B.label}</span>
        {broadcast.title ? <span className={styles.roomTitle}>{broadcast.title}</span> : null}
        {hostLine ? <span className={styles.roomMeta}>{hostLine}</span> : null}
        <div className={styles.roomButtons}>
          <Link href={broadcast.href} className={`${styles.primaryButton} ${styles.grow}`}>
            {B.watch}
          </Link>
          <Link href={broadcast.href} className={styles.quietButton}>
            {B.chat}
          </Link>
        </div>
      </div>
    </section>
  );
}

// The Main Room while a broadcast is on and nobody is in the room: one quiet row.
function QuietMainRoom({ room }: { room: SeTodayRoom }) {
  const { open } = useSeRooms();
  return (
    <section aria-label={room.name} className={styles.weavers}>
      <span className={styles.weaversText}>
        <span className={styles.roomName}>
          {room.name} <span className={styles.roomMeta}>· {W.mainAudience}</span>
        </span>
        <span className={styles.weaversLine}>{B.roomQuiet}</span>
      </span>
      <button type="button" className={styles.quietButton} onClick={() => open('main', room.nextTalk)}>
        {W.open}
      </button>
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
// `broadcasting`: a broadcast is live, so a Main Room nobody is in shows as one quiet row.
export function RoomCard({ room, broadcasting = false }: { room: SeTodayRoom; broadcasting?: boolean }) {
  if (room.key === 'weavers') return <WeaversRow room={room} />;
  return broadcasting && !room.live ? <QuietMainRoom room={room} /> : <MainRoomCard room={room} />;
}
