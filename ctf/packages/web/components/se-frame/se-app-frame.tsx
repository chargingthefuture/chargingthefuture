'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_AVENHOOD, SE_AVENHOOD_DEFINITION, SE_TABS, type SeTab, type SeThemeChoice } from '@ctf/shared';
import type { ShellCurrentUser } from '../community-shell/shell-types';
import { SeTabBar } from './se-tab-bar';
import { TodayScreen } from './today/today-screen';
import { MeScreen } from './me/me-screen';
import { useSeTheme } from './use-se-theme';
import { NewScreen } from './new/new-screen';
import { ActivityScreen } from './activity/activity-screen';
import { PeopleScreen } from './people/people-screen';
import { SeRoomBar, SeRoomHosts } from './rooms/se-room-screen';
import { SeRoomsProvider, useSeRooms } from './rooms/se-rooms';
import { seThemeVars } from './se-theme-vars';
import { useInterfaceSwitch } from './use-interface-switch';
import styles from './se-frame.module.css';

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
        <TabScreen tab={tab} currentUser={currentUser} isAdmin={isAdmin} theme={theme} onTheme={setTheme} onBack={back} saving={saving} />
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </main>
      <SeRoomHosts currentUser={currentUser} />
      <SeRoomBar />
      <SeTabBar active={tab} onSelect={select} />
    </div>
  );
}
