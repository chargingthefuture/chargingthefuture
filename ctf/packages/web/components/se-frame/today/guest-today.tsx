'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  SE_DAYS_WON_TITLE,
  SE_GUEST_WORDS as W,
  seDaysWonLines,
  seGuestAnswersBySignUp,
  seGuestNextRoomLine,
  seGuestStartedLine,
  seTalkCalendarEvent,
  seTheme,
  seTodayView,
  type SeToday,
  type SeTodayCard,
  type SeTodayTalk,
} from '@ctf/shared';
import { AddToCalendarButton } from '@/components/shared/add-to-calendar';
import { ChymeGuestListen, GuestNote } from '@/components/chyme/chyme-guest-listen';
import { ChymeReadingsPlayer } from '@/components/chyme/readings/chyme-readings-player';
import { ChymeTokensContext, seChymeTokens } from '@/components/chyme/chyme-tokens-context';
import { SeAvatar } from '@/components/shared/se-avatar';
import { useSeTheme } from '../use-se-theme';
import { useGuestRoom } from './use-guest-room';
import { useToday } from './use-today';
import styles from './today.module.css';

// Today for a visitor who is not signed in, built to the approved "Today, signed out" board: Days
// won with what Skills Economy is and Sign up, the Main Room with Listen as a guest in place (or, on
// a quiet day, the readings and the next room), the day's cards read only, asks and offers from "A
// member" with Sign up to answer, and People locked until a member is reviewed.

function Hero({ today, signUpUrl }: { today: SeToday | null; signUpUrl: string }) {
  const big = today?.daysWon ? seDaysWonLines(today.daysWon).big : null;
  return (
    <section aria-label={SE_DAYS_WON_TITLE} className={styles.daysWon}>
      <span className={styles.daysWonLabel}>{SE_DAYS_WON_TITLE}</span>
      {big ? <span className={styles.daysWonBig}>{big}</span> : null}
      <span className={styles.daysWonSmall}>{W.hero}</span>
      <a href={signUpUrl} className={styles.heroButton}>
        {W.signUp}
      </a>
    </section>
  );
}

function Listening({ participantCount, guestCount, listenAllowed, listenUnavailable, onGone }: {
  participantCount: number;
  guestCount: number;
  listenAllowed: boolean;
  listenUnavailable: string | null;
  onGone: () => void;
}) {
  const { theme } = useSeTheme();
  const tokens = useMemo(() => seChymeTokens(seTheme(theme.color, theme.mode)), [theme.color, theme.mode]);
  return (
    <ChymeTokensContext.Provider value={tokens}>
      {listenAllowed ? (
        <ChymeGuestListen participantCount={participantCount} guestCount={guestCount} accent={tokens.ACCENT} onRoomGone={onGone} />
      ) : (
        <GuestNote accent={tokens.ACCENT} text={W.listenUnavailable} detail={listenUnavailable ?? 'The server sent no reason.'} />
      )}
    </ChymeTokensContext.Provider>
  );
}

function LiveRoom({ talk, room, onGone }: { talk: SeTodayTalk | null; room: Extract<ReturnType<typeof useGuestRoom>['room'], { kind: 'ready' }>; onGone: () => void }) {
  const [listening, setListening] = useState(false);
  return (
    <section aria-label="Live room" className={styles.roomCard}>
      <div className={styles.roomHead}>
        <span className={styles.liveBadge}>{W.live}</span>
        {talk?.onAir ? <span className={styles.roomMeta}>{seGuestStartedLine(talk.startIso)}</span> : null}
      </div>
      <span className={styles.roomTitle}>{talk?.onAir ? talk.title : 'Main Room'}</span>
      {listening ? (
        <Listening {...room} onGone={onGone} />
      ) : (
        <>
          <span className={styles.roomMeta}>{W.listenNote}</span>
          <button type="button" className={styles.primaryButton} onClick={() => setListening(true)}>
            {W.listen}
          </button>
        </>
      )}
    </section>
  );
}

function QuietRoom({ talk, onLive }: { talk: SeTodayTalk | null; onLive: () => void }) {
  const { theme } = useSeTheme();
  const tokens = useMemo(() => seChymeTokens(seTheme(theme.color, theme.mode)), [theme.color, theme.mode]);
  return (
    <section aria-label="Rooms" className={styles.roomCard}>
      <span className={styles.roomTitle}>{W.quiet}</span>
      <ChymeTokensContext.Provider value={tokens}>
        <ChymeReadingsPlayer onRoomLive={onLive} />
      </ChymeTokensContext.Provider>
      {talk && !talk.onAir ? (
        <div className={styles.nextRoom}>
          <span className={styles.roomMeta}>{W.nextRoom}</span>
          <span className={styles.nextRoomWhen}>{seGuestNextRoomLine(talk.startIso)}</span>
          <AddToCalendarButton color="var(--se-ink)" borderColor="var(--se-line)" event={seTalkCalendarEvent(talk)} style={{ alignSelf: 'flex-start' }} />
        </div>
      ) : null}
    </section>
  );
}

function RoomCard({ today }: { today: SeToday | null }) {
  const { room, reload } = useGuestRoom();
  const talk = today?.rooms[0]?.nextTalk ?? null;
  if (room.kind === 'loading') return null;
  if (room.kind === 'failed') {
    return (
      <section aria-label="Rooms" className={styles.roomCard}>
        <span className={styles.roomMeta}>{room.message}</span>
        <button type="button" className={styles.actionButton} onClick={() => void reload()}>
          {W.tryAgain}
        </button>
      </section>
    );
  }
  if (room.isLive) return <LiveRoom talk={talk} room={room} onGone={() => void reload()} />;
  return <QuietRoom talk={talk} onLive={() => void reload()} />;
}

function GuestCard({ card, signUpUrl }: { card: SeTodayCard; signUpUrl: string }) {
  const color = `var(--se-kind-${card.kind})`;
  const bySignUp = seGuestAnswersBySignUp(card);
  return (
    <article className={styles.card}>
      <span className={styles.guestDot} style={{ background: color }} aria-hidden="true" />
      <div className={styles.cardHead}>
        {bySignUp ? <SeAvatar accountId={card.id} size={28} /> : null}
        {bySignUp ? <span className={styles.handle}>{W.member}</span> : null}
        <span className={styles.label} style={{ color }}>
          {card.label}
        </span>
      </div>
      <span className={styles.cardTitle}>{card.title}</span>
      {card.body && !bySignUp ? <span className={`${styles.body} ${styles.bodyClosed}`}>{card.body}</span> : null}
      <div className={styles.actions}>
        {bySignUp ? (
          <a href={signUpUrl} className={styles.actionButton}>
            {W.answer}
          </a>
        ) : (
          card.actions.map((item) => (
            <Link key={item.kind + item.label} href={item.href} className={styles.actionButton}>
              {item.label}
            </Link>
          ))
        )}
      </div>
    </article>
  );
}

export function GuestToday({ signUpUrl }: { signUpUrl: string }) {
  const { today, loading, error, marks, reload } = useToday(null);
  const view = seTodayView(today, marks, 'all');
  return (
    <>
      <Hero today={today} signUpUrl={signUpUrl} />
      <RoomCard today={today} />
      <div className={styles.listHead}>
        <h2 className={styles.listTitle}>{W.cardsTitle}</h2>
        <span className={styles.doneCount}>{W.readOnly}</span>
      </div>
      {error ? (
        <div role="alert" className={styles.notice}>
          <span>{error}</span>
          <button type="button" className={styles.actionButton} onClick={() => void reload()}>
            {W.tryAgain}
          </button>
        </div>
      ) : null}
      {!today && loading ? <p className={styles.noticeQuiet}>{W.loading}</p> : null}
      <div className={styles.timeline}>
        <span className={styles.line} aria-hidden="true" />
        {view.cards.map((card) => (
          <GuestCard key={card.id} card={card} signUpUrl={signUpUrl} />
        ))}
        <article className={`${styles.card} ${styles.lockedCard}`}>
          <span className={styles.guestDot} style={{ background: 'var(--se-kind-match)' }} aria-hidden="true" />
          <span className={styles.cardTitle}>{W.peopleTitle}</span>
          <span className={styles.body}>{W.peopleLocked}</span>
        </article>
      </div>
    </>
  );
}
