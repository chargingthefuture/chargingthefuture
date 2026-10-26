'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import '@fontsource-variable/dm-sans/opsz.css';
import { SE_AVEN_DEFINITION, SE_AVENHOOD, SE_AVENHOOD_DEFINITION, SE_TABS, type SeTab } from '@ctf/shared';
import type { ShellCurrentUser } from '../community-shell/shell-types';
import { SeTabBar } from './se-tab-bar';
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

function NotBuiltYet({ onBack, saving }: { onBack: () => void; saving: boolean }) {
  return (
    <section className={styles.emptyCard}>
      <p className={styles.emptyTitle}>This screen is still being built.</p>
      <p className={styles.emptyText}>Everything you use today is in 3.0, unchanged.</p>
      <button type="button" className={styles.secondaryButton} onClick={onBack} disabled={saving}>
        Back to 3.0
      </button>
    </section>
  );
}

function MeScreen({ currentUser, onBack, saving }: { currentUser: ShellCurrentUser; onBack: () => void; saving: boolean }) {
  return (
    <>
      <ScreenHeader title="Me" />
      <section className={styles.card}>
        <span className={styles.handle}>{currentUser.displayName}</span>
      </section>
      <section className={styles.card}>
        <p className={styles.cardLabel}>About</p>
        <p className={styles.cardTitle}>The {SE_AVENHOOD}</p>
        <p className={styles.emptyText}>{SE_AVENHOOD_DEFINITION}</p>
        <p className={styles.emptyText}>{SE_AVEN_DEFINITION}</p>
      </section>
      <section className={styles.card}>
        <p className={styles.cardLabel}>Settings</p>
        <p className={styles.emptyText}>You are using 3.1. You can go back to 3.0 at any time.</p>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.secondaryButton} onClick={onBack} disabled={saving}>
            Back to 3.0
          </button>
          <Link href="/account" className={styles.textLink}>
            Account and data
          </Link>
        </div>
      </section>
    </>
  );
}

export function SeAppFrame({ currentUser }: { currentUser: ShellCurrentUser }) {
  const [tab, setTab] = useState<SeTab>('today');
  const { switchTo, saving, error } = useInterfaceSwitch();

  useEffect(() => {
    setTab(readTab());
    const onPop = () => setTab(readTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const select = useCallback((next: SeTab) => {
    setTab(next);
    const url = next === 'today' ? '/' : `/?tab=${next}`;
    window.history.pushState(null, '', url);
    window.scrollTo(0, 0);
  }, []);

  const back = () => void switchTo('3.0');

  return (
    <div className={styles.frame} style={seThemeVars()}>
      <main className={styles.screen}>
        {tab === 'today' ? <TodayHeader /> : null}
        {tab === 'people' ? <ScreenHeader title="People" /> : null}
        {tab === 'new' ? <ScreenHeader title="New" /> : null}
        {tab === 'activity' ? <ScreenHeader title="Activity" /> : null}
        {tab === 'me' ? (
          <MeScreen currentUser={currentUser} onBack={back} saving={saving} />
        ) : (
          <NotBuiltYet onBack={back} saving={saving} />
        )}
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </main>
      <SeTabBar active={tab} onSelect={select} />
    </div>
  );
}
