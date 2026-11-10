'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TiRadioGuide } from 'lib/ti-radio/types';
import { SE_TALK_WORDS as W, seTalkIntro } from '@ctf/shared';
import { requestJson } from '@/components/ti-radio/ti-radio-shared';
import { TalkBook } from './talk-book';
import { TalkLocked } from './talk-locked';
import styles from './new.module.css';
import sheet from './sheet.module.css';

// + New → Talk: book an empty 90 minutes on TI Radio, held in the Chyme Main Room. The same routes
// the TI Radio guide uses, so the same rules apply (Unlock approval, the per-day limit, no overlap).
// A member not verified yet sees why, and the next talk they can listen to.

type GuideState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; guide: TiRadioGuide };

function useGuide() {
  const [state, setState] = useState<GuideState>({ kind: 'loading' });
  const load = useCallback(async () => {
    try {
      const payload = await requestJson<{ guide: TiRadioGuide }>('/api/ti-radio/guide');
      setState({ kind: 'ready', guide: payload.guide });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : W.loadFailed });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}

function TalkBody({ state, reload }: { state: GuideState; reload: () => Promise<void> }) {
  if (state.kind === 'loading') return <p className={styles.text}>{W.loading}</p>;
  if (state.kind === 'error') {
    return (
      <p role="alert" className={styles.error}>
        {state.message}{' '}
        <button type="button" className={styles.linkButton} onClick={() => void reload()}>
          {W.tryAgain}
        </button>
      </p>
    );
  }
  if (!state.guide.viewer.canHost) return <TalkLocked slots={state.guide.slots} />;
  return <TalkBook slots={state.guide.slots} reload={reload} />;
}

export function TalkForm() {
  const { state, reload } = useGuide();
  return (
    <>
      <div className={sheet.headLeft}>
        <h1 className={sheet.titleSmall}>{W.heading}</h1>
        <p className={sheet.sub}>{seTalkIntro()}</p>
      </div>
      <TalkBody state={state} reload={reload} />
    </>
  );
}
