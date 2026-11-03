// The bar at the bottom of the live room, the Android copy of the web (web components/chyme/
// se-room/se-room-controls.tsx): Leave quietly, then Bring someone in, Raise hand and the
// microphone. Before the member joins it reads Listen in instead.

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_LIVE_ROOM_WORDS as W, SE_TODAY_ROOM_WORDS } from '@ctf/shared';
import { useBringSomeoneIn } from '../../../components/shared/useBringSomeoneIn';
import { useChymeWords } from '../chyme-words';
import { SeRoomIcon } from './SeRoomIcon';
import { useSeRoomStyles } from './useSeRoomStyles';

export type SeRoomHand = { raised: boolean; onToggle: () => void };
// `disabled` while the member may not speak (hand-raise mode, or before Unlock); the notice above
// the bar says why.
export type SeRoomMic = { muted: boolean; onToggle: () => void; disabled: boolean };

function BringButton({ onBring }: { onBring: () => void }) {
  const { t, s } = useSeRoomStyles();
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={SE_TODAY_ROOM_WORDS.bring} onPress={onBring} style={s.round}>
      <SeRoomIcon name="bringIn" color={t.ink} />
    </TouchableOpacity>
  );
}

function MicButton({ mic }: { mic: SeRoomMic }) {
  const { t, s } = useSeRoomStyles();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={mic.muted ? W.unmute : W.mute}
      accessibilityState={{ disabled: mic.disabled }}
      disabled={mic.disabled}
      onPress={mic.onToggle}
      style={[s.mic, mic.muted ? null : s.micOn, mic.disabled ? s.disabled : null]}
    >
      <SeRoomIcon name={mic.muted ? 'micOff' : 'micOn'} color={mic.muted ? t.onBtn : t.ink} />
    </TouchableOpacity>
  );
}

function HandButton({ hand }: { hand: SeRoomHand }) {
  const { t, s } = useSeRoomStyles();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={hand.raised ? W.lowerHand : W.raiseHand}
      accessibilityState={{ selected: hand.raised }}
      onPress={hand.onToggle}
      style={[s.round, hand.raised ? s.roundOn : null]}
    >
      <SeRoomIcon name="hand" color={hand.raised ? t.onPick : t.ink} />
    </TouchableOpacity>
  );
}

// In the call. `hand` is left out for a member who cannot ask to speak, `mic` while the call is
// still connecting. `bringIn` is the Main Room only: the link it shares opens that room.
export function SeRoomControls({ onLeave, hand, mic, bringIn }: { onLeave: () => void; hand?: SeRoomHand; mic?: SeRoomMic; bringIn: boolean }) {
  const { s } = useSeRoomStyles();
  const words = useChymeWords();
  const { note, bring } = useBringSomeoneIn();
  return (
    <>
      <View style={s.bar}>
        <TouchableOpacity accessibilityRole="button" onPress={onLeave} style={s.pill}>
          <Text style={s.pillText}>{words.leave}</Text>
        </TouchableOpacity>
        <View style={s.grow} />
        {bringIn ? <BringButton onBring={() => void bring()} /> : null}
        {hand ? <HandButton hand={hand} /> : null}
        {mic ? <MicButton mic={mic} /> : null}
      </View>
      {note ? <Text accessibilityRole="alert" style={s.note}>{note}</Text> : null}
    </>
  );
}

// Before joining: Listen in, and in the Main Room Bring someone in.
export function SeRoomJoinControls({ joining, onJoin, bringIn }: { joining: boolean; onJoin: () => void; bringIn: boolean }) {
  const { s } = useSeRoomStyles();
  const words = useChymeWords();
  const { note, bring } = useBringSomeoneIn();
  return (
    <>
      <View style={s.bar}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: joining }} disabled={joining} onPress={onJoin} style={[s.join, joining ? s.disabled : null]}>
          <Text style={s.joinText}>{joining ? W.joining : words.join}</Text>
        </TouchableOpacity>
        <View style={s.grow} />
        {bringIn ? <BringButton onBring={() => void bring()} /> : null}
      </View>
      {note ? <Text accessibilityRole="alert" style={s.note}>{note}</Text> : null}
    </>
  );
}
