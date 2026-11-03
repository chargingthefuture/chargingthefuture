'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { SE_ROOM_QUIET, SE_ROOM_QUIET_TEXT, seRoomBarLine, seRoomView, seTheme, type SeRoomView } from '@ctf/shared';
import {
  ChymeLiveShellView,
  useChymeRoomSession,
  type ChymeRoomScope,
} from '@/components/chyme/chyme-live-shell';
import { ChymeEmbedContext, type ChymeEmbed, type ChymeLiveSummary } from '@/components/chyme/chyme-embed';
import { ChymeTokensContext, seChymeTokens } from '@/components/chyme/chyme-tokens-context';
import { ChymeWordsProvider } from '@/components/chyme/chyme-words';
import { ChymeReadingsPlayer } from '@/components/chyme/readings/chyme-readings-player';
import type { CurrentUser } from '@/components/chyme/chyme-shared';
import { useSeTheme } from '../use-se-theme';
import { useSeRooms, type SeRoomSummary } from './se-rooms';
import { SeRoomHeader } from './se-room-header';
import styles from './rooms.module.css';

export { SeRoomBar } from './se-room-bar';

// One room inside the 3.1 frame, to the board "Live room": the header (se-room-header.tsx), the
// quiet state, then the Chyme room drawn to the board (components/chyme/se-room/). The session
// lives here, so the call keeps running while the screen is hidden behind another tab.

function QuietState({ view }: { view: SeRoomView }) {
  if (!view.quiet) return null;
  return (
    <div className={styles.quiet}>
      <p className={styles.quietTitle}>{SE_ROOM_QUIET}</p>
      <p className={styles.quietText}>{SE_ROOM_QUIET_TEXT}</p>
      <ChymeReadingsPlayer />
    </div>
  );
}

function barSummary(view: SeRoomView, count: number, live: ChymeLiveSummary | null): SeRoomSummary {
  return {
    joined: view.joined,
    name: view.name,
    count,
    title: view.heading,
    line: live ? seRoomBarLine(live.speakers.map((speaker) => speaker.name), live.selfSpeaking) : `${count} here`,
    faces: live ? live.speakers.slice(0, 2).map((speaker) => speaker.id) : [],
    canRaiseHand: Boolean(live?.canRaiseHand),
    handRaised: Boolean(live?.handRaised),
  };
}

// Keeps the room bar told what this room is doing, and how to leave it and raise a hand from there.
function useBarReport(scope: ChymeRoomScope, summary: SeRoomSummary, leave: () => Promise<void>, handToggle: MutableRefObject<(() => void) | null>) {
  const { report } = useSeRooms();
  const key = JSON.stringify(summary);
  useEffect(() => {
    report(scope, JSON.parse(key) as SeRoomSummary, { leave: () => void leave(), toggleHand: () => handToggle.current?.() });
  }, [report, scope, key, leave, handToggle]);
}

// The room's view and its count, from the room read (null until it arrives) and the talk on Today.
function useRoomView(scope: ChymeRoomScope, session: ReturnType<typeof useChymeRoomSession>) {
  const { talks } = useSeRooms();
  const room = session.room;
  const joined = session.joinState === 'ready';
  const count = room ? room.participants.length : null;
  const view = seRoomView(scope, { joined, name: room ? room.roomName : null, count }, talks.main ?? null);
  return { view, count: count ?? 0, live: joined || Boolean(room?.callActive) };
}

function SeRoomScreen({ scope, currentUser, visible }: { scope: ChymeRoomScope; currentUser: CurrentUser; visible: boolean }) {
  const { minimize } = useSeRooms();
  const session = useChymeRoomSession(scope);
  const room = session.room;
  const [moreOpen, setMoreOpen] = useState(false);
  const [live, setLive] = useState<ChymeLiveSummary | null>(null);
  const handToggle = useRef<(() => void) | null>(null);
  const { view, count, live: liveNow } = useRoomView(scope, session);
  useBarReport(scope, barSummary(view, count, live), session.handleLeave, handToggle);

  const embed: ChymeEmbed = {
    moreOpen,
    setMoreOpen,
    refresh: () => void session.refreshRoom(),
    refreshing: session.refreshing,
    join: () => void session.handleJoin(),
    joining: session.joinState === 'joining',
    reportLive: setLive,
    handToggle,
  };

  return (
    <section className={styles.screen} hidden={!visible} aria-label={view.name}>
      <SeRoomHeader
        view={view}
        live={liveNow}
        startedAtIso={live?.startedAtIso ?? null}
        onBack={minimize}
        onMore={room ? () => setMoreOpen(true) : null}
        moreOpen={moreOpen}
      />
      <QuietState view={view} />
      <ChymeEmbedContext.Provider value={embed}>
        <ChymeWordsProvider words={view.words}>
          <ChymeLiveShellView session={session} currentUser={currentUser} roomScope={scope} embedded />
        </ChymeWordsProvider>
      </ChymeEmbedContext.Provider>
    </section>
  );
}

// Chyme's parts (the readings loop, the stage, the call) drawn in the member's 3.1 colors.
function SeRoomColors({ children }: { children: React.ReactNode }) {
  const { theme } = useSeTheme();
  const tokens = useMemo(() => seChymeTokens(seTheme(theme.color, theme.mode)), [theme.color, theme.mode]);
  return <ChymeTokensContext.Provider value={tokens}>{children}</ChymeTokensContext.Provider>;
}

// Every room the member has open, mounted; only the one being looked at is visible.
export function SeRoomHosts({ currentUser }: { currentUser: CurrentUser }) {
  const { opened, shown } = useSeRooms();
  return (
    <SeRoomColors>
      {opened.map((scope) => (
        <SeRoomScreen key={scope} scope={scope} currentUser={currentUser} visible={shown === scope} />
      ))}
    </SeRoomColors>
  );
}
