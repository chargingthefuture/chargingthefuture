'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_STORY_REPLIES_VISITORS_WORDS as W, type SeStoryRepliesVisitorsState } from '@ctf/shared';
import styles from '../today/matching-toggle.module.css';

// Settings → Safety and privacy: whether visitors without an account may read what the member writes
// in the conversation on members' stories (owner decision, 2026-11-16). Off until the member turns it
// on; off again hides their replies from visitors at once. Approved members only: for anybody else
// the route refuses and nothing is drawn.

const URL = '/api/today/story-replies/visitors';

function useStoryReplies() {
  const [state, setState] = useState<SeStoryRepliesVisitorsState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch(URL, { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return setState(null);
    const data = (await res.json().catch(() => null)) as SeStoryRepliesVisitorsState | null;
    setState(data ? { agreed: data.agreed === true } : null);
  }, []);
  useEffect(() => void load(), [load]);
  const set = async (agreed: boolean) => {
    setBusy(true);
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ agreed }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as (SeStoryRepliesVisitorsState & { message?: string }) | null;
    setBusy(false);
    if (!res?.ok || !data) return setNote(`${W.failed} ${data?.message ?? 'the app could not be reached.'}`);
    setNote(null);
    setState({ agreed: data.agreed === true });
  };
  return { state, note, busy, set };
}

export function StoryRepliesToggle() {
  const { state, note, busy, set } = useStoryReplies();
  if (!state) return null;
  return (
    <section className={styles.card} aria-label={W.title}>
      <label className={styles.row}>
        <span className={styles.toggleText}>{W.toggle}</span>
        <input type="checkbox" role="switch" className={styles.switch} checked={state.agreed} disabled={busy} onChange={(event) => void set(event.target.checked)} />
      </label>
      <p className={styles.hint}>{W.hint}</p>
      {note ? (
        <p role="alert" className={styles.hint}>
          {note}
        </p>
      ) : null}
    </section>
  );
}
