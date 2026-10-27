import Link from 'next/link';
import { seRoomPeopleLine, type SeTodayBroadcast, type SeTodayRoom } from '@ctf/shared';
import styles from './today.module.css';

// The Main Room at the top of Today, and the broadcast card above it while the System Architect is
// live. Rooms in full (the room bar, the Weavers room, booking a talk) come with the Rooms screens.

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

export function RoomCard({ room }: { room: SeTodayRoom }) {
  return (
    <section aria-label={room.name} className={styles.roomCard}>
      <div className={styles.roomHead}>
        {room.live ? <span className={styles.liveBadge}>LIVE</span> : null}
        <span className={styles.roomName}>{room.name}</span>
        <span className={styles.roomMeta}>· open to everyone</span>
      </div>
      <span className={styles.roomMeta}>{seRoomPeopleLine(room.members, room.guests)}</span>
      <Link href={room.href} className={styles.primaryButton}>
        {room.live ? 'Listen in' : 'Open the room'}
      </Link>
    </section>
  );
}
