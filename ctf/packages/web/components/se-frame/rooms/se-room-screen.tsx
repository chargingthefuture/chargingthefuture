'use client';

import { useEffect } from 'react';
import { SE_ROOM_QUIET, SE_ROOM_QUIET_TEXT, seRoomView, seRoomWords, seTalkLine, type SeRoomView } from '@ctf/shared';
import {
  ChymeLiveShellView,
  useChymeRoomSession,
  type ChymeRoomScope,
} from '@/components/chyme/chyme-live-shell';
import { ChymeWordsProvider } from '@/components/chyme/chyme-words';
import { ChymeReadingsPlayer } from '@/components/chyme/readings/chyme-readings-player';
import type { CurrentUser } from '@/components/chyme/chyme-shared';
import { useSeRooms } from './se-rooms';
import styles from './rooms.module.css';

// One room inside the 3.1 frame: its own header, the talk that is on or next, the room rule, the notice that
// guests may be listening, the quiet state, and then the Chyme room itself in the 3.1 words. The
// session lives here, so the call keeps running while the screen is hidden behind another tab.

function RoomHeader({ view, onMinimize }: { view: SeRoomView; onMinimize: () => void }) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.minimize} onClick={onMinimize}>
        <span aria-hidden="true">⌄</span> {view.minimizeLabel}
      </button>
      <h1 className={styles.title}>{view.name}</h1>
      <p className={styles.meta}>{view.audience}</p>
      {view.talkLine ? <p className={styles.talk}>{view.talkLine}</p> : null}
      <p className={styles.meta}>{view.rule}</p>
    </header>
  );
}

function RoomNotices({ view }: { view: SeRoomView }) {
  return (
    <>
      {view.joined && view.words.guestNotice ? (
        <p role="status" className={styles.notice}>
          {view.words.guestNotice}
        </p>
      ) : null}
      {view.quiet ? (
        <div className={styles.quiet}>
          <p className={styles.quietTitle}>{SE_ROOM_QUIET}</p>
          <p className={styles.quietText}>{SE_ROOM_QUIET_TEXT}</p>
          <ChymeReadingsPlayer />
        </div>
      ) : null}
    </>
  );
}

function SeRoomScreen({ scope, currentUser, visible }: { scope: ChymeRoomScope; currentUser: CurrentUser; visible: boolean }) {
  const { report, minimize, talks } = useSeRooms();
  const session = useChymeRoomSession(scope);
  const room = session.room;
  const view = seRoomView(
    scope,
    { joined: session.joinState === 'ready', name: room ? room.roomName : null, count: room ? room.participants.length : null },
    seTalkLine(talks.main ?? null),
  );
  const leave = session.handleLeave;
  const { joined, name } = view;
  const count = room ? room.participants.length : 0;

  useEffect(() => {
    report(scope, { joined, name, count }, () => void leave());
  }, [report, scope, joined, name, count, leave]);

  return (
    <section className={styles.screen} hidden={!visible} aria-label={view.name}>
      <RoomHeader view={view} onMinimize={minimize} />
      <RoomNotices view={view} />
      <div className={styles.room}>
        <ChymeWordsProvider words={view.words}>
          <ChymeLiveShellView session={session} currentUser={currentUser} roomScope={scope} />
        </ChymeWordsProvider>
      </div>
    </section>
  );
}

// Every room the member has open, mounted; only the one being looked at is visible.
export function SeRoomHosts({ currentUser }: { currentUser: CurrentUser }) {
  const { opened, shown } = useSeRooms();
  return (
    <>
      {opened.map((scope) => (
        <SeRoomScreen key={scope} scope={scope} currentUser={currentUser} visible={shown === scope} />
      ))}
    </>
  );
}

// The room in the call, while the member is somewhere else in the app.
export function SeRoomBar() {
  const { opened, shown, summaries, open, leave } = useSeRooms();
  const scope = opened.find((item) => summaries[item]?.joined && item !== shown);
  if (!scope) return null;
  const summary = summaries[scope];
  const words = seRoomWords(scope);
  return (
    <div className={styles.bar} role="region" aria-label="Room you are in">
      <button type="button" className={styles.barOpen} onClick={() => open(scope)}>
        <span className={styles.barDot} aria-hidden="true" />
        <span className={styles.barName}>{summary?.name}</span>
        <span className={styles.barCount}>{summary?.count ?? 0} here</span>
      </button>
      <button type="button" className={styles.barLeave} onClick={() => leave(scope)}>
        {words.leave}
      </button>
    </div>
  );
}
