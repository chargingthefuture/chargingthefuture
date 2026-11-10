'use client';

import Link from 'next/link';
import { SE_TALK_WORDS as W, seNextTalk, seNextTalkLine, seTalkCalendarEvent, type SeTalkSlot } from '@ctf/shared';
import { AddToCalendarButton } from '@/components/shared/add-to-calendar';
import sheet from './sheet.module.css';

// + New → Talk for a member not verified yet, to the approved board "Schedule a talk, not yet
// verified": why booking waits for Unlock, and the next talk on the schedule to listen to.
export function TalkLocked({ slots }: { slots: SeTalkSlot[] }) {
  const next = seNextTalk(slots);
  return (
    <>
      <section className={sheet.lockCard} aria-labelledby="se-talk-locked">
        <h2 id="se-talk-locked" className={sheet.lockTitle}>
          {W.lockedTitle}
        </h2>
        <p className={sheet.sub}>{W.lockedText}</p>
        <Link href={W.unlockHref} className={sheet.lockButton}>
          {W.finishUnlock}
        </Link>
      </section>
      <section className={sheet.nextCard} aria-labelledby="se-talk-next">
        <h2 id="se-talk-next" className={sheet.nextLabel}>
          {W.nextTalk}
        </h2>
        {next ? (
          <>
            <span className={sheet.nextTitle}>{next.title}</span>
            <span className={sheet.sub}>{seNextTalkLine(next)}</span>
            <AddToCalendarButton color="var(--se-ink)" borderColor="var(--se-line)" event={seTalkCalendarEvent(next)} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          </>
        ) : (
          <span className={sheet.sub}>{W.nothingBooked}</span>
        )}
      </section>
    </>
  );
}
