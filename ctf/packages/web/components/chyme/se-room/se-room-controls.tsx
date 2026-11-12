'use client';

import { SE_LIVE_ROOM_WORDS as W, SE_TODAY_ROOM_WORDS, SE_WEAVERS_LIMIT_WORDS, type SeBringIn } from '@ctf/shared';
import { useBringSomeoneIn } from '@/components/shared/use-bring-someone-in';
import { useChymeWords } from '../chyme-words';
import { SeRoomIcon } from './se-room-icon';
import styles from './se-room.module.css';

// The bar at the bottom of the live room, to the board: Leave quietly, then Bring someone in, Raise
// hand and the microphone. Before the member joins it reads Listen in instead.

export type SeRoomHand = { raised: boolean; onToggle: () => void };
// `disabled` while the member may not speak (hand-raise mode, or before Unlock); the notice above the
// bar says why.
export type SeRoomMic = { muted: boolean; onToggle: () => void; disabled: boolean };

function BringButton({ onBring }: { onBring: () => void }) {
  return (
    <button type="button" className={styles.round} aria-label={SE_TODAY_ROOM_WORDS.bring} title={SE_TODAY_ROOM_WORDS.bring} onClick={onBring}>
      <SeRoomIcon name="bringIn" />
    </button>
  );
}

function MicButton({ mic }: { mic: SeRoomMic }) {
  const label = mic.muted ? W.unmute : W.mute;
  return (
    <button type="button" className={styles.mic} aria-label={label} title={label} data-on={!mic.muted} disabled={mic.disabled} onClick={mic.onToggle}>
      <SeRoomIcon name={mic.muted ? 'micOff' : 'micOn'} />
    </button>
  );
}

function HandButton({ hand }: { hand: SeRoomHand }) {
  const label = hand.raised ? W.lowerHand : W.raiseHand;
  return (
    <button type="button" className={styles.round} aria-label={label} title={label} aria-pressed={hand.raised} onClick={hand.onToggle}>
      <SeRoomIcon name="hand" />
    </button>
  );
}

// In the call. `hand` is left out for a member who cannot ask to speak, `mic` while the call is
// still connecting. `bringIn` is the Main Room only: the link it shares opens that room. A member without the
// Weavers badge sees the plan's line in its place.
export function SeRoomControls({ onLeave, hand, mic, bringIn }: { onLeave: () => void; hand?: SeRoomHand; mic?: SeRoomMic; bringIn: SeBringIn }) {
  const words = useChymeWords();
  const { note, bring } = useBringSomeoneIn();
  return (
    <>
      <div className={styles.bar}>
        <button type="button" className={styles.pill} onClick={onLeave}>
          {words.leave}
        </button>
        <span className={styles.grow} />
        {bringIn === 'button' ? <BringButton onBring={() => void bring()} /> : null}
        {hand ? <HandButton hand={hand} /> : null}
        {mic ? <MicButton mic={mic} /> : null}
      </div>
      {bringIn === 'weavers_only' ? <p className={styles.note}>{SE_WEAVERS_LIMIT_WORDS.bring}</p> : null}
      {note ? <p role="status" className={styles.note}>{note}</p> : null}
    </>
  );
}

// Before joining: Listen in, and in the Main Room Bring someone in.
export function SeRoomJoinControls({ joining, onJoin, bringIn }: { joining: boolean; onJoin: () => void; bringIn: SeBringIn }) {
  const words = useChymeWords();
  const { note, bring } = useBringSomeoneIn();
  return (
    <>
      <div className={styles.bar}>
        <button type="button" className={styles.join} disabled={joining} aria-live="polite" onClick={onJoin}>
          {joining ? W.joining : words.join}
        </button>
        <span className={styles.grow} />
        {bringIn === 'button' ? <BringButton onBring={() => void bring()} /> : null}
      </div>
      {bringIn === 'weavers_only' ? <p className={styles.note}>{SE_WEAVERS_LIMIT_WORDS.bring}</p> : null}
      {note ? <p role="status" className={styles.note}>{note}</p> : null}
    </>
  );
}
