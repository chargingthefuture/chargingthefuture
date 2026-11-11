'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { SE_GOAL_SHARE_LINK, SE_GOAL_SHARE_WORDS as W, seGoalSharePicture, seGoalShareText, seTheme, type SeGoalShare } from '@ctf/shared';
import { useSeTheme } from '../use-se-theme';
import { seThemeVars } from '../se-theme-vars';
import { GoalSharePicture } from './goal-share-picture';
import { savePicture } from './goal-share-export';
import { qrFor } from './goal-share-qr';
import { reportError } from 'lib/observability/report';
import styles from './goal-share-sheet.module.css';

// The approved 3.1 board "Share picture": a sheet with Close, the picture that will be saved, Save
// picture and Copy as text. Opened from the "Your goal" card on Today and from the member's own goal
// on the PeerProgramming board. It sets its own theme variables, so it looks the same on the board,
// which is drawn outside the 3.1 frame.

export type GoalShareSharer = { handle: string; accountId: string } | null;

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' | 'error'; text: string };

function fileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `goal-${slug || 'shared'}.png`;
}

function useShareActions(share: SeGoalShare, svg: RefObject<SVGSVGElement | null>, size: { width: number; height: number }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const save = async () => {
    if (!svg.current) return;
    setStatus({ kind: 'busy' });
    try {
      await savePicture(svg.current, size.width, size.height, fileName(share.title));
      setStatus({ kind: 'done', text: W.saved });
    } catch (error) {
      reportError(error, { area: 'goal-share', op: 'save_picture' });
      setStatus({ kind: 'error', text: W.saveFailed });
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(seGoalShareText(share));
      setStatus({ kind: 'done', text: W.copied });
    } catch {
      // no-trace: the browser refused the clipboard; the sheet says so.
      setStatus({ kind: 'error', text: W.copyFailed });
    }
  };
  return { status, save, copy };
}

export function GoalShareSheet({ share, sharer, onClose }: { share: SeGoalShare; sharer: GoalShareSharer; onClose: () => void }) {
  const { theme } = useSeTheme();
  const svg = useRef<SVGSVGElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const picture = useMemo(() => seGoalSharePicture(share, sharer, seTheme(theme.color, theme.mode), qrFor(SE_GOAL_SHARE_LINK)), [share, sharer, theme.color, theme.mode]);
  const actions = useShareActions(share, svg, picture);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => (event.key === 'Escape' ? onClose() : undefined);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const { status } = actions;
  return (
    <div className={styles.backdrop} style={seThemeVars(theme.color, theme.mode)}>
      <button type="button" className={styles.scrim} aria-label={W.close} tabIndex={-1} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={W.title} className={styles.sheet}>
        <div className={styles.head}>
          <h2 className={styles.title}>{W.title}</h2>
          <button ref={closeRef} type="button" aria-label={W.close} className={styles.round} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <figure className={styles.figure} aria-label={W.picture}>
          <GoalSharePicture ref={svg} picture={picture} label={`${W.picture}: ${share.title}`} />
        </figure>
        <span className={styles.spacer} />
        {status.kind === 'done' ? <p role="status" className={styles.hint}>{status.text}</p> : null}
        {status.kind === 'error' ? <p role="alert" className={styles.hint}>{status.text}</p> : null}
        <button type="button" className={styles.primary} disabled={status.kind === 'busy'} onClick={() => void actions.save()}>
          {status.kind === 'busy' ? W.saving : W.save}
        </button>
        <button type="button" className={styles.secondary} onClick={() => void actions.copy()}>
          {W.copy}
        </button>
      </section>
    </div>
  );
}
