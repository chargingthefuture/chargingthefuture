// The 3.1 room before the member joins the call, the Android copy of the web (web components/chyme/
// se-room/se-room-idle.tsx): who is in it, from the room read, then Listen in. Signed-out guests are
// counted under Listening but not drawn, since the room read gives their number only.

import React from 'react';
import { View } from 'react-native';
import { SE_LIVE_ROOM_WORDS as W, seRoomName, seRoomOnStage } from '@ctf/shared';
import { chymeHandle, type ChymeRoomResponse, type ChymeRoomScope } from '../ChymeApi';
import { useChymeEmbed } from '../chyme-embed';
import { SeRoomStage, type SeStageEntry } from './SeRoomStage';
import { SeRoomJoinControls } from './SeRoomControls';
import { SeRoomMoreSheet, SeRoomNotice } from './SeRoomMore';
import { useSeRoomStyles } from './useSeRoomStyles';
import { seBringIn } from './SeRoomControls';

function toEntry(participant: ChymeRoomResponse['participants'][number], room: ChymeRoomResponse, currentUserId: string): SeStageEntry {
  const micOn = participant.micOn === true;
  return {
    key: participant.userId,
    accountId: participant.userId,
    name: participant.userId === currentUserId ? W.you : seRoomName(chymeHandle(participant.username, participant.userId)),
    onStage: seRoomOnStage({ micOn, guest: false, role: participant.role }, room.speakMode ?? 'open'),
    micOn,
    talking: false,
    handRaised: participant.handRaised,
  };
}

export function SeRoomIdle({ room, currentUserId, scope }: { room: ChymeRoomResponse; currentUserId: string; scope: ChymeRoomScope }) {
  const embed = useChymeEmbed();
  const { s } = useSeRoomStyles();
  const entries = room.participants.map((participant) => toEntry(participant, room, currentUserId));
  return (
    <View style={s.room}>
      <SeRoomStage entries={entries} extraListeners={room.guestCount ?? 0} />
      <SeRoomJoinControls joining={embed?.joining ?? false} onJoin={() => embed?.join()} bringIn={scope === 'main' ? seBringIn(room.viewer) : false} />
      <SeRoomMoreSheet />
    </View>
  );
}

// The quota policy's line and the hand-raise notice, in the 3.1 look.
export function SeRoomStateNotices({ room }: { room: ChymeRoomResponse }) {
  return (
    <>
      {room.quota.notice ? <SeRoomNotice warn={room.quota.band === 'red'}>{room.quota.notice}</SeRoomNotice> : null}
      {room.speakMode === 'hand_raise' ? <SeRoomNotice>{W.handRaiseMode}</SeRoomNotice> : null}
    </>
  );
}
