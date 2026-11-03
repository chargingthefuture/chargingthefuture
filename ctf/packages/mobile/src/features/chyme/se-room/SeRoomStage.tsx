// Who is in the live room, the Android copy of the web (web components/chyme/se-room/
// se-room-stage.tsx): Speaking as a three-across grid of rings, then "Listening · N" as a
// four-across grid of faces.

import React from 'react';
import { Text, View } from 'react-native';
import { SE_LIVE_ROOM_WORDS as W, seListeningLabel } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { SeRoomIcon } from './SeRoomIcon';
import { useSeRoomStyles } from './useSeRoomStyles';
import type { SeRoomStyles } from './seRoomStyles';

// One person as the board draws them. `onStage` puts them under Speaking; `talking` is the Stream
// SDK's "their voice is heard right now".
export type SeStageEntry = {
  key: string;
  accountId: string;
  name: string;
  onStage: boolean;
  micOn: boolean;
  talking: boolean;
  handRaised: boolean;
};

function HandMark({ s, color }: { s: SeRoomStyles; color: string }) {
  return (
    <View style={s.hand} accessible accessibilityLabel={W.handUp}>
      <SeRoomIcon name="hand" size={14} color={color} />
    </View>
  );
}

function Speaker({ entry }: { entry: SeStageEntry }) {
  const { t, s } = useSeRoomStyles();
  return (
    <View style={s.speaker}>
      <View style={[s.ring, entry.micOn ? s.ringOn : null, entry.talking ? s.ringTalking : null]}>
        <View style={s.face}>
          <SeAvatar accountId={entry.accountId} size={70} />
        </View>
        {entry.handRaised ? <HandMark s={s} color={t.onPick} /> : null}
      </View>
      <Text numberOfLines={1} style={s.speakerName}>
        {entry.name}
      </Text>
      <Text style={s.speakerState}>{entry.micOn ? W.speakingNow : W.muted}</Text>
    </View>
  );
}

function Listener({ entry }: { entry: SeStageEntry }) {
  const { t, s } = useSeRoomStyles();
  return (
    <View style={s.listener}>
      <View>
        <View style={s.face}>
          <SeAvatar accountId={entry.accountId} size={52} />
        </View>
        {entry.handRaised ? <HandMark s={s} color={t.onPick} /> : null}
      </View>
      <Text numberOfLines={1} style={s.listenerName}>
        {entry.name}
      </Text>
    </View>
  );
}

// `extraListeners` are people counted but not drawn: signed-out guests before the member joins.
export function SeRoomStage({ entries, extraListeners = 0 }: { entries: SeStageEntry[]; extraListeners?: number }) {
  const { s } = useSeRoomStyles();
  const speakers = entries.filter((entry) => entry.onStage);
  const listeners = entries.filter((entry) => !entry.onStage);
  const listening = listeners.length + extraListeners;
  return (
    <>
      {speakers.length > 0 ? (
        <View style={s.speaking} accessibilityLabel={W.speaking}>
          {speakers.map((entry) => (
            <Speaker key={entry.key} entry={entry} />
          ))}
        </View>
      ) : null}
      {listening > 0 ? (
        <View style={s.listening} accessibilityLabel={W.listening}>
          <Text style={s.listeningLabel}>{seListeningLabel(listening)}</Text>
          <View style={s.listeners}>
            {listeners.map((entry) => (
              <Listener key={entry.key} entry={entry} />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}
