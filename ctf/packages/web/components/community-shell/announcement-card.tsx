'use client';

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import styles from './community-shell.module.css';

type AnnouncementCardProps = {
  // The posting authority — almost always "Survivor Hub". Passed in so the card matches whatever
  // label the stream resolved rather than hardcoding it.
  senderName: string;
  // The announcement heading, shown bold above the body. Null when the announcement has no title.
  title: string | null;
  // The announcement body (the message text, with the title already split out server-side).
  body: string;
  // Display-only formatted time label (same one the chat bubbles use).
  time: string;
  // A mandatory announcement gets the amber "Urgent" badge so it reads as must-see at a glance.
  mandatory: boolean;
};

// Official Survivor Hub announcement, rendered as a distinct card (emerald treatment, shield
// "Official" badge, optional "Urgent" badge) so it stands out from peer chat bubbles and AI answers
// instead of blending into the purple stream. Announcements have no reply/reaction affordances —
// they are one-way, so the card carries only the header, an optional title, the body, and the time.
export function AnnouncementCard({ senderName, title, body, time, mandatory }: AnnouncementCardProps) {
  return (
    <article className={styles.announcementCard} aria-label="Official announcement">
      <div className={styles.announcementHead}>
        <div className={styles.announcementAvatar} aria-hidden="true">SH</div>
        <div className={styles.announcementHeadText}>
          <div className={styles.announcementTitleRow}>
            <span className={styles.announcementName}>{senderName}</span>
            <span className={styles.announcementOfficialBadge}>
              <ShieldCheck size={12} color="currentColor" /> Official
            </span>
            {mandatory ? (
              <span className={styles.announcementUrgentBadge}>
                <AlertTriangle size={12} color="currentColor" /> Urgent
              </span>
            ) : null}
          </div>
          <span className={styles.announcementTime}>{time}</span>
        </div>
      </div>
      {title ? <p className={styles.announcementTitle}>{title}</p> : null}
      <p className={styles.announcementBody}>{body}</p>
    </article>
  );
}
