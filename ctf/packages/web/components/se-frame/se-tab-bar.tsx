'use client';

import { SE_TAB_LABELS, SE_TABS, type SeTab } from '@ctf/shared';
import styles from './se-frame.module.css';

const ICONS: Record<SeTab, React.ReactNode> = {
  today: <path d="M4 7h16M4 12h16M4 17h10" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5 6.5-5s5.7 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.3 3.6 5" />
    </>
  ),
  new: <path d="M12 5v14M5 12h14" />,
  activity: <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0" />,
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
};

function TabIcon({ tab }: { tab: SeTab }) {
  const isNew = tab === 'new';
  return (
    <svg
      width={isNew ? 22 : 20}
      height={isNew ? 22 : 20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={isNew ? 2.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[tab]}
    </svg>
  );
}

export function SeTabBar({ active, onSelect }: { active: SeTab; onSelect: (tab: SeTab) => void }) {
  return (
    <nav aria-label="Main" className={styles.tabBar}>
      {SE_TABS.map((tab) =>
        tab === 'new' ? (
          <button
            key={tab}
            type="button"
            aria-label={SE_TAB_LABELS.new}
            aria-current={active === tab ? 'page' : undefined}
            className={styles.newButton}
            onClick={() => onSelect(tab)}
          >
            <TabIcon tab={tab} />
          </button>
        ) : (
          <button
            key={tab}
            type="button"
            aria-current={active === tab ? 'page' : undefined}
            className={active === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => onSelect(tab)}
          >
            <TabIcon tab={tab} />
            {SE_TAB_LABELS[tab]}
          </button>
        ),
      )}
    </nav>
  );
}
