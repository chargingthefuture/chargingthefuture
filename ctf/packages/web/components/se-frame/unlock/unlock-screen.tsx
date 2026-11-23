'use client';

import { SE_UNLOCK_SCREEN_WORDS as W, type SeUnlockFocus } from '@ctf/shared';
import { UnlockStageCard } from './unlock-stage-card';
import { UnlockRemovedRoutes } from './unlock-removed-routes';
import { UnlockHelp } from './unlock-help';
import { UnlockWhy } from './unlock-why';
import { useUnlockScreen, type SeUnlockScreenData } from './use-unlock-screen';
import styles from './unlock-screen.module.css';

// The Unlock screen in the 3.1 frame: everything the 3.0 Unlock page does for a member, in the 3.1
// design (the Unlock banner's card and words, the frame's back header). It opens from the banner's
// "Why this step" and "Can't find it?", People's and + New → Talk's "Finish Unlock". Opened from one
// of the banner's two links, the section that link names comes first, so the member lands on it.
export function UnlockScreen({ focus, onBack, onToday }: { focus: SeUnlockFocus; onBack: () => void; onToday: () => void }) {
  const { data, reload } = useUnlockScreen();
  return (
    <div className={styles.stack}>
      <div className={styles.top}>
        <button type="button" className={styles.back} aria-label={W.back} onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className={styles.title}>{W.title}</h1>
      </div>
      {focus === 'why' ? <UnlockWhy /> : null}
      <p className={styles.lead}>{W.lead}</p>
      <Body data={data} reload={reload} onToday={onToday} helpFirst={focus === 'help'} />
      {focus === 'why' ? null : <UnlockWhy />}
    </div>
  );
}

function Body({ data, reload, onToday, helpFirst }: { data: SeUnlockScreenData; reload: () => void; onToday: () => void; helpFirst: boolean }) {
  if (data.kind === 'loading') {
    return (
      <p className={styles.note} role="status">
        {W.loading}
      </p>
    );
  }
  if (data.kind === 'error') {
    return (
      <div className={styles.card}>
        <p role="alert" className={styles.text}>
          {data.message}
        </p>
        <button type="button" className={styles.secondary} onClick={reload}>
          {W.tryAgain}
        </button>
      </div>
    );
  }
  // Help finding the address stays offered until approval, as on the 3.0 page, waiting included.
  const help = data.stage !== 'approved' ? <UnlockHelp onAsked={reload} /> : null;
  return (
    <>
      {helpFirst ? help : null}
      <UnlockStageCard stage={data.stage} standing={data.standing} helpAsked={data.helpAsked} onSent={reload} onToday={onToday} />
      {data.stage === 'send' ? <UnlockRemovedRoutes onFinished={reload} /> : null}
      {helpFirst ? null : help}
    </>
  );
}
