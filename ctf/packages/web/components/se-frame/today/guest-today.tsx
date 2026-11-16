'use client';

import { useSignedOutTheme } from '../use-signed-out-theme';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  SE_DAYS_WON_TITLE,
  SE_DAYS_WON_WHY,
  SE_GUEST_WORDS as W,
  seDaysWonLines,
  seGuestAnswersBySignUp,
  seGuestDaysWon,
  seGuestTickDelayMs,
  seGuestOpensSheet,
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
import { useGuestRoom } from './use-guest-room';
import { useToday } from './use-today';
import { GuestSheet } from './guest-sheet';
import { CardDotIcon } from './card-dot-icon';
import { EmojiRainShower } from './emoji-rain';
import styles from './today.module.css';

// Today for a visitor who is not signed in, built to the approved "Today, signed out" board: Days
// won (a Preview count that ticks up now and then) with what Skills Economy is and Sign up, the Main
// Room with Listen as a guest in place (or, on a quiet day, the readings and the next room), the
// day's cards read only, asks and offers from "A member" with Sign up to answer, a blog story with
// Read the post and Conversation, and People locked until a member is reviewed.

// The small tag on anything read from sample data rather than members' own rows: a lock and
// "Preview", so a visitor reads it as private rather than empty.
function SampleTag() {
  return (
    <span className={styles.sampleTag} aria-label={W.sampleLabel} title={W.sampleLabel}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span aria-hidden="true">{W.sample}</span>
    </span>
  );
}

// Signed out, the sample Days won count goes up by one at random intervals while the page is open,
// with a shower of emoji (owner decision, 2026-11-16). Nothing is written anywhere; it stays tagged
// Preview, and with less motion asked for the number still ticks and no emoji fall.
function useLivelyDaysWon(daysWon: SeToday['daysWon'] | undefined) {
  const [ticks, setTicks] = useState(0);
  const shown = Boolean(daysWon);
  useEffect(() => {
    if (!shown) return;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        setTicks((count) => count + 1);
        next();
      }, seGuestTickDelayMs(Math.random()));
    };
    next();
    return () => window.clearTimeout(timer);
  }, [shown]);
  return { daysWon: seGuestDaysWon(daysWon, ticks), ticks };
}

function Hero({ today, signUpUrl }: { today: SeToday | null; signUpUrl: string }) {
  const { daysWon, ticks } = useLivelyDaysWon(today?.daysWon);
  const big = daysWon ? seDaysWonLines(daysWon).big : null;
  return (
    <section aria-label={SE_DAYS_WON_TITLE} className={styles.daysWon}>
      <span className={styles.daysWonLabel}>
        {SE_DAYS_WON_TITLE}
        {big && daysWon?.sample ? <> <SampleTag /></> : null}
      </span>
      {big ? <span className={styles.daysWonBig}>{big}</span> : null}
      <span className={styles.daysWonSmall}>{W.hero}</span>
      <a href={SE_DAYS_WON_WHY.href} target="_blank" rel="noreferrer" className={styles.howButton}>
        {SE_DAYS_WON_WHY.label}
      </a>
      <a href={signUpUrl} className={styles.heroButton}>
        {W.signUp}
      </a>
      <EmojiRainShower run={ticks} />
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
  const theme = useSignedOutTheme();
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
  const theme = useSignedOutTheme();
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
          {talk.title ? <span className={styles.nextRoomTitle}>{talk.title}</span> : null}
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

function GuestCard({ card, signUpUrl, signInUrl }: { card: SeTodayCard; signUpUrl: string; signInUrl: string }) {
  const color = `var(--se-kind-${card.kind})`;
  const bySignUp = seGuestAnswersBySignUp(card);
  const [open, setOpen] = useState(false);
  return (
    <article className={styles.card}>
      <span className={styles.guestDot} style={{ background: color }} aria-hidden="true">
        <CardDotIcon kind={card.kind} />
      </span>
      <div className={styles.cardHead}>
        {bySignUp ? <SeAvatar accountId={card.id} size={28} /> : null}
        {bySignUp ? <span className={styles.handle}>{W.member}</span> : null}
        <span className={styles.label} style={{ color }}>
          {card.label}
        </span>
        {card.sample ? <SampleTag /> : null}
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
        {seGuestOpensSheet(card) ? (
          <button type="button" className={styles.actionButton} onClick={() => setOpen(true)}>
            {W.conversation}
          </button>
        ) : null}
      </div>
      {open ? <GuestSheet card={card} signInUrl={signInUrl} sampleTag={<SampleTag />} onClose={() => setOpen(false)} /> : null}
    </article>
  );
}

export function GuestToday({ signUpUrl, signInUrl }: { signUpUrl: string; signInUrl: string }) {
  const { today, loading, error, marks, reload } = useToday(null);
  const view = seTodayView(today, marks, 'all');
  return (
    <>
      <Hero today={today} signUpUrl={signUpUrl} />
      <RoomCard today={today} />
      <div className={styles.listHead}>
        <h2 className={styles.listTitle}>{W.cardsTitle}</h2>
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
          <GuestCard key={card.id} card={card} signUpUrl={signUpUrl} signInUrl={signInUrl} />
        ))}
        <article className={`${styles.card} ${styles.lockedCard}`}>
          <span className={styles.guestDot} style={{ background: 'var(--se-kind-match)' }} aria-hidden="true">
            <CardDotIcon kind="match" />
          </span>
          <span className={styles.cardTitle}>{W.peopleTitle}</span>
          <span className={styles.body}>{W.peopleLocked}</span>
        </article>
      </div>
      <p className={styles.sampleNote}>{W.sampleNote}</p>
    </>
  );
}
