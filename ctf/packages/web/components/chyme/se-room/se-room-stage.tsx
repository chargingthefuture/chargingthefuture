'use client';

import { SE_LIVE_ROOM_WORDS as W, seListeningLabel } from '@ctf/shared';
import { SeAvatar } from '@/components/shared/se-avatar';
import { SeRoomIcon } from './se-room-icon';
import styles from './se-room.module.css';

// One person in the room as the 3.1 board draws them. `onStage` puts them under Speaking,
// everybody else is under Listening; `talking` is the Stream SDK's "their voice is heard right now".
export type SeStageEntry = {
  key: string;
  accountId: string;
  name: string;
  onStage: boolean;
  micOn: boolean;
  talking: boolean;
  handRaised: boolean;
};

function HandMark() {
  return (
    <span className={styles.hand} role="img" aria-label={W.handUp}>
      <SeRoomIcon name="hand" size={14} />
    </span>
  );
}

function Speaker({ entry }: { entry: SeStageEntry }) {
  return (
    <div className={styles.speaker}>
      <div className={styles.ring} data-mic={entry.micOn ? 'on' : 'off'} data-talking={entry.talking}>
        <span className={styles.face}>
          <SeAvatar accountId={entry.accountId} size={70} />
        </span>
        {entry.handRaised ? <HandMark /> : null}
      </div>
      <span className={styles.speakerName}>{entry.name}</span>
      <span className={styles.speakerState}>{entry.micOn ? W.speakingNow : W.muted}</span>
    </div>
  );
}

function Listener({ entry }: { entry: SeStageEntry }) {
  return (
    <div className={styles.listener}>
      <span className={styles.marked}>
        <span className={styles.face}>
          <SeAvatar accountId={entry.accountId} size={52} />
        </span>
        {entry.handRaised ? <HandMark /> : null}
      </span>
      <span className={styles.listenerName}>{entry.name}</span>
    </div>
  );
}

// Speaking as a three-across grid of rings, then "Listening · N" as a four-across grid of faces.
// `extraListeners` are people counted but not drawn: signed-out guests before the member joins.
export function SeRoomStage({ entries, extraListeners = 0 }: { entries: SeStageEntry[]; extraListeners?: number }) {
  const speakers = entries.filter((entry) => entry.onStage);
  const listeners = entries.filter((entry) => !entry.onStage);
  const listening = listeners.length + extraListeners;
  return (
    <>
      {speakers.length > 0 ? (
        <section aria-label={W.speaking} className={styles.speaking}>
          {speakers.map((entry) => (
            <Speaker key={entry.key} entry={entry} />
          ))}
        </section>
      ) : null}
      {listening > 0 ? (
        <section aria-label={W.listening} className={styles.listening}>
          <p className={styles.listeningLabel}>{seListeningLabel(listening)}</p>
          <div className={styles.listeners}>
            {listeners.map((entry) => (
              <Listener key={entry.key} entry={entry} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
