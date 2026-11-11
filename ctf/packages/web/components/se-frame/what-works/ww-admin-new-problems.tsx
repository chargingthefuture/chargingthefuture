'use client';

import { useState } from 'react';
import { SE_WW_ADMIN_WORDS as W, seWwHelpedCount, seWwPendingMeta } from '@ctf/shared';
import { reasonText } from 'lib/errors/client-failure';
import { seThemeVars } from '../se-theme-vars';
import { useSeTheme } from '../use-se-theme';
import { useWwPending, wwAdminPost, type WwPending, type WwPendingState } from './use-ww-pending';
import { WwAdminMergeTwo, type WwListedProblem } from './ww-admin-merge-two';
import styles from './ww-admin.module.css';

// New problems members added, oldest first. Each is approved as new, merged into a problem already
// on the list (what was added under it moves there), or deleted as spam. Who added it is never
// shown. Below them, two problems already on the list can be merged.

type Action = 'approve' | 'merge' | 'spam';
type Props = { listed: WwListedProblem[]; onChanged: () => Promise<void> };

const SENT = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

function sentLabel(iso: string): string {
  return SENT.format(new Date(iso)).replace(/, (\d{4}),/, ', $1 at');
}

function MergeTarget({ item, listed, intoId, setIntoId }: { item: WwPending; listed: WwListedProblem[]; intoId: string; setIntoId: (_id: string) => void }) {
  const id = `se-ww-into-${item.id}`;
  return (
    <>
      <label htmlFor={id} className={styles.fieldLabel}>
        {W.mergeInto}
      </label>
      <select id={id} className={styles.select} value={intoId} onChange={(e) => setIntoId(e.target.value)}>
        {intoId ? null : <option value="">{W.mergeIntoMenu}</option>}
        {listed.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </>
  );
}

type ActionsProps = { matched: boolean; showTarget: boolean; canMerge: boolean; busy: boolean; run: (_a: Action) => void; openTarget: () => void };

// With a close match, Merge leads; without one, Approve as new leads and Merge into… opens the menu.
function CardActions({ matched, showTarget, canMerge, busy, run, openTarget }: ActionsProps) {
  const merge = (
    <button type="button" className={matched ? styles.primary : styles.secondary} disabled={busy || !canMerge} onClick={() => run('merge')}>
      {W.merge}
    </button>
  );
  const approve = (
    <button type="button" className={matched ? styles.secondary : styles.primary} disabled={busy} onClick={() => run('approve')}>
      {W.approve}
    </button>
  );
  const openMenu = (
    <button type="button" className={styles.secondary} disabled={busy} onClick={openTarget}>
      {W.mergeIntoMenu}
    </button>
  );
  return (
    <div className={styles.actions}>
      {matched ? merge : approve}
      {matched ? approve : showTarget ? merge : openMenu}
      <button type="button" className={styles.danger} disabled={busy} onClick={() => run('spam')}>
        {W.spam}
      </button>
    </div>
  );
}

function LooksLike({ item }: { item: WwPending }) {
  if (!item.suggestion) return null;
  return (
    <p className={styles.looks}>
      <b>{W.looksLike}</b> {item.suggestion.title} ({seWwHelpedCount(item.suggestion.helpedCount).toLowerCase()})
    </p>
  );
}

function PendingCard({ item, first, listed, onDone }: { item: WwPending; first: boolean; listed: WwListedProblem[]; onDone: () => Promise<void> }) {
  const matched = item.suggestion !== null;
  const [intoId, setIntoId] = useState(item.suggestion?.id ?? '');
  const [showTarget, setShowTarget] = useState(matched);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (action: Action) => {
    setBusy(true);
    setMessage(null);
    try {
      await wwAdminPost(`/api/what-works/admin/problems/${item.id}/review`, { action, intoId: action === 'merge' ? intoId : undefined });
      await onDone();
    } catch (error) {
      setMessage(reasonText(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={first ? styles.cardFirst : styles.card}>
      <p className={styles.problem}>{item.title}</p>
      <span className={styles.meta}>{seWwPendingMeta(sentLabel(item.createdAt), item.attachedCount, matched)}</span>
      <LooksLike item={item} />
      {showTarget ? <MergeTarget item={item} listed={listed} intoId={intoId} setIntoId={setIntoId} /> : null}
      <CardActions matched={matched} showTarget={showTarget} canMerge={Boolean(intoId)} busy={busy} run={(a) => void run(a)} openTarget={() => setShowTarget(true)} />
      {message ? (
        <p role="alert" className={styles.error}>
          {message}
        </p>
      ) : null}
    </article>
  );
}

function PendingList({ state, listed, onDone }: { state: WwPendingState; listed: WwListedProblem[]; onDone: () => Promise<void> }) {
  if (state.kind === 'loading') return <p className={styles.note}>{W.loading}</p>;
  if (state.kind === 'error') return <p role="alert" className={styles.error}>{state.message}</p>;
  if (state.items.length === 0) return <p className={styles.note}>{W.empty}</p>;
  return (
    <>
      {state.items.map((item, i) => (
        <PendingCard key={item.id} item={item} first={i === 0} listed={listed} onDone={onDone} />
      ))}
    </>
  );
}

export function WwAdminNewProblems({ listed, onChanged }: Props) {
  const { theme } = useSeTheme();
  const pending = useWwPending();
  const [showAll, setShowAll] = useState(false);
  const count = pending.state.kind === 'ready' ? pending.state.items.length : 0;
  const done = async () => {
    await pending.reload();
    await onChanged();
  };
  return (
    <section aria-labelledby="se-ww-new" className={styles.screen} style={seThemeVars(theme.color, theme.mode)}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>{W.eyebrow}</span>
        <h2 id="se-ww-new" className={styles.title}>
          {W.title(count)}
        </h2>
      </div>
      <PendingList state={pending.state} listed={listed} onDone={done} />
      <button type="button" className={styles.link} aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
        {showAll ? W.hideAll : W.allProblems}
      </button>
      {showAll ? <WwAdminMergeTwo listed={listed} onMerged={done} /> : null}
    </section>
  );
}
