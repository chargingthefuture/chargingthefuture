'use client';

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { SE_LIVE_ROOM_WORDS as W } from '@ctf/shared';
import { SeAvatar } from '@/components/shared/se-avatar';
import { useChymeEmbed } from '../chyme-embed';
import { SeRoomIcon } from './se-room-icon';
import styles from './se-room.module.css';

// What sits behind the room's More button: the actions the room already had, gathered in one sheet
// so the stage stays as the board draws it. Refresh the room for everybody; the admin's speak-mode
// switch; and, for each other person in the call, Tip, Mute for me, Back Channel and an admin's
// moderation actions. Opened from the header, drawn by whichever part of the room is showing.

export type SeRoomPerson = { key: string; accountId: string; name: string; actions: ReactNode };

function People({ people }: { people: SeRoomPerson[] }) {
  return (
    <>
      <p className={styles.sheetLabel}>{W.people}</p>
      {people.length === 0 ? <p className={styles.status}>{W.noPeople}</p> : null}
      <ul className={styles.people}>
        {people.map((person) => (
          <li key={person.key} className={styles.person}>
            <span className={styles.personName}>
              <SeAvatar accountId={person.accountId} size={32} />
              {person.name}
            </span>
            <div className={styles.personActions}>{person.actions}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

// Escape closes the sheet; opening it moves focus into it.
function useSheetKeys(open: boolean, close: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
  return panel;
}

export function SeRoomMoreSheet({ admin, people }: { admin?: ReactNode; people?: SeRoomPerson[] }) {
  const embed = useChymeEmbed();
  const titleId = useId();
  const open = Boolean(embed?.moreOpen);
  const setMoreOpen = embed?.setMoreOpen;
  const close = useCallback(() => setMoreOpen?.(false), [setMoreOpen]);
  const panel = useSheetKeys(open, close);
  if (!embed || !open) return null;
  return (
    <div className={styles.sheetLayer}>
      <button type="button" className={styles.backdrop} aria-label={W.close} onClick={close} />
      <div ref={panel} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={styles.sheetHead}>
          <h2 id={titleId} className={styles.sheetTitle}>
            {W.moreTitle}
          </h2>
          <button type="button" className={styles.round} aria-label={W.close} onClick={close}>
            <SeRoomIcon name="close" size={16} strokeWidth={2.4} />
          </button>
        </div>
        <button type="button" className={styles.pill} disabled={embed.refreshing} onClick={embed.refresh}>
          {embed.refreshing ? W.refreshing : W.refresh}
        </button>
        {admin}
        {people ? <People people={people} /> : null}
      </div>
    </div>
  );
}

// A one-line notice in the room: the quota policy, hand-raise mode, a dropped connection.
export function SeRoomNotice({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return (
    <div role="status" className={styles.notice} data-tone={warn ? 'warn' : 'plain'}>
      {children}
    </div>
  );
}
