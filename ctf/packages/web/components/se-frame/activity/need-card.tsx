'use client';

import type { SeActivityNeed } from '@ctf/shared';
import { SeAvatar } from '../../shared/se-avatar';
import { useActivityAnswer } from './use-activity-answer';
import styles from './activity.module.css';

// A notice in Needs you with its answer in place (approved board "Activity"): a Just us two request
// shows the asker's picture and Agree / Not now; a Recurring Activity invite shows Confirm / That's
// not right; the day-14 notice shows its one-tap keep-up.

export function NeedCard({ need, onRead }: { need: SeActivityNeed; onRead: (_id: string, _keepShown: boolean) => void }) {
  const { status, answer } = useActivityAnswer((keepShown) => onRead(need.item.id, keepShown));
  const busy = status.kind === 'busy';
  return (
    <section aria-label={need.item.summary} className={need.partnerId ? `${styles.need} ${styles.needStrong}` : styles.need}>
      <div className={styles.needHead}>
        {need.partnerId ? <SeAvatar accountId={need.partnerId} size={36} className={styles.avatar} /> : null}
        <span className={styles.needText}>{need.item.summary}</span>
      </div>
      {status.kind === 'done' ? (
        <p role="status" className={styles.note}>
          {status.text}
        </p>
      ) : (
        <div className={styles.buttons}>
          {need.buttons.map((button) => (
            <button
              key={button.label}
              type="button"
              disabled={busy}
              className={styles[button.look]}
              onClick={() => void answer(button)}
            >
              {busy && status.label === button.label ? button.busy : button.label}
            </button>
          ))}
        </div>
      )}
      {status.kind === 'error' ? (
        <p role="alert" className={styles.note}>
          {status.text}
        </p>
      ) : null}
    </section>
  );
}
