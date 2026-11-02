'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { SE_AVENHOOD, SE_AVENHOOD_DEFINITION, SE_TABS, type SeTab, type SeThemeChoice } from '@ctf/shared';
import type { ShellCurrentUser } from '../community-shell/shell-types';
import { SeTabBar } from './se-tab-bar';
import { TodayScreen } from './today/today-screen';
import { useSeTheme } from './use-se-theme';
import { UnlockBanner } from './unlock-banner';
import { SeRoomsProvider, useSeRooms } from './rooms/se-rooms';
import { seThemeVars } from './se-theme-vars';
import { useInterfaceSwitch } from './use-interface-switch';
import styles from './se-frame.module.css';

// Today is the first card a member sees, so only Today is in the first load (3.1 speed budget:
// under 3 seconds cold on a low-cost phone). The other tabs, and the room screens with their call
// code, load the first time they are opened.
const NewScreen = dynamic(() => import('./new/new-screen').then((m) => m.NewScreen));
const MeScreen = dynamic(() => import('./me/me-screen').then((m) => m.MeScreen));
const ActivityScreen = dynamic(() => import('./activity/activity-screen').then((m) => m.ActivityScreen));
const PeopleScreen = dynamic(() => import('./people/people-screen').then((m) => m.PeopleScreen));
const SeRoomHosts = dynamic(() => import('./rooms/se-room-screen').then((m) => m.SeRoomHosts), { ssr: false });
const SeRoomBar = dynamic(() => import('./rooms/se-room-screen').then((m) => m.SeRoomBar), { ssr: false });

// The 3.1 app frame: one screen per tab, the tab bar along the bottom. The tab is kept in the
// address (?tab=people) so the back button and a shared link land on the same tab.

function readTab(): SeTab {
  if (typeof window === 'undefined') return 'today';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return SE_TABS.includes(tab as SeTab) ? (tab as SeTab) : 'today';
}

const TODAY_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

function ScreenHeader({ title }: { title: string }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
    </header>
  );
}

// "Today in the Avenhood", with the word itself a button that opens its definition in place.
function TodayHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className={styles.header}>
      <span className={styles.eyebrow}>{TODAY_DATE.format(new Date())}</span>
      <h1 className={styles.title}>
        Today in the{' '}
        <button
          type="button"
          className={styles.termButton}
          aria-expanded={open}
          aria-controls="se-avenhood-definition"
          onClick={() => setOpen((value) => !value)}
        >
          {SE_AVENHOOD}
        </button>
      </h1>
      {open ? (
        <p id="se-avenhood-definition" className={styles.definition}>
          {SE_AVENHOOD_DEFINITION}
        </p>
      ) : null}
    </header>
  );
}

type FrameProps = { currentUser: ShellCurrentUser; isAdmin: boolean };

export function SeAppFrame({ currentUser, isAdmin }: FrameProps) {
  return (
    <SeRoomsProvider>
      <SeAppFrameBody currentUser={currentUser} isAdmin={isAdmin} />
    </SeRoomsProvider>
  );
}

const TAB_TITLES: Partial<Record<SeTab, string>> = { people: 'People', new: 'New', activity: 'Activity' };

type TabScreenProps = FrameProps & {
  tab: SeTab;
  theme: SeThemeChoice;
  onTheme: (_next: SeThemeChoice) => void;
  onBack: () => void;
  saving: boolean;
};

function TabScreen({ tab, currentUser, isAdmin, theme, onTheme, onBack, saving }: TabScreenProps) {
  const title = TAB_TITLES[tab];
  return (
    <>
      {tab === 'today' ? <TodayHeader /> : null}
      {title ? <ScreenHeader title={title} /> : null}
      {tab === 'today' ? <TodayScreen accountId={currentUser.userId} /> : null}
      {tab === 'new' ? <NewScreen /> : null}
      {tab === 'me' ? <MeScreen currentUser={currentUser} isAdmin={isAdmin} theme={theme} onTheme={onTheme} onBack={onBack} saving={saving} /> : null}
      {tab === 'activity' ? <ActivityScreen /> : null}
      {tab === 'people' ? <PeopleScreen /> : null}
    </>
  );
}

function SeAppFrameBody({ currentUser, isAdmin }: FrameProps) {
  const { theme, setTheme } = useSeTheme();
  const [tab, setTab] = useState<SeTab>('today');
  const rooms = useSeRooms();
  const { minimize } = rooms;
  const { switchTo, saving, error } = useInterfaceSwitch();

  useEffect(() => {
    setTab(readTab());
    const onPop = () => setTab(readTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Choosing a tab while a room is open puts the room in the bar above the tab bar.
  const select = useCallback((next: SeTab) => {
    minimize();
    setTab(next);
    const url = next === 'today' ? '/' : `/?tab=${next}`;
    window.history.pushState(null, '', url);
    window.scrollTo(0, 0);
  }, [minimize]);

  const back = () => void switchTo('3.0');

  return (
    <div className={styles.frame} style={seThemeVars(theme.color, theme.mode)}>
      <main className={styles.screen} hidden={rooms.shown !== null}>
        <UnlockBanner />
        <TabScreen tab={tab} currentUser={currentUser} isAdmin={isAdmin} theme={theme} onTheme={setTheme} onBack={back} saving={saving} />
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </main>
      {rooms.opened.length > 0 ? (
        <>
          <SeRoomHosts currentUser={currentUser} />
          <SeRoomBar />
        </>
      ) : null}
      <SeTabBar active={tab} onSelect={select} />
    </div>
  );
}
