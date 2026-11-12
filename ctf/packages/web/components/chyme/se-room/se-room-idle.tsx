'use client';

import { SE_LIVE_ROOM_WORDS as W, seRoomName, seRoomOnStage } from '@ctf/shared';
import type { ChymeRoomResponse } from 'lib/chyme/types';
import { chymeHandle } from '../chyme-shared';
import { useChymeEmbed } from '../chyme-embed';
import { SeRoomStage, type SeStageEntry } from './se-room-stage';
import { SeRoomJoinControls } from './se-room-controls';
import { SeRoomMoreSheet, SeRoomNotice } from './se-room-more';
import styles from './se-room.module.css';

// The 3.1 room before the member joins the call: who is in it, from the room read (each member's
// microphone as their app last reported it), then Listen in. Signed-out guests are counted under
// Listening but not drawn, since the room read gives their number only.

function toEntry(participant: ChymeRoomResponse['participants'][number], room: ChymeRoomResponse, currentUserId: string): SeStageEntry {
  const micOn = participant.micOn === true;
  return {
    key: participant.userId,
    accountId: participant.userId,
    name: participant.userId === currentUserId ? W.you : seRoomName(chymeHandle(participant.username, participant.userId)),
    onStage: seRoomOnStage({ micOn, guest: false, role: participant.role }, room.speakMode),
    micOn,
    talking: false,
    handRaised: participant.handRaised,
  };
}

export function SeRoomIdle({ room, currentUserId, roomScope }: { room: ChymeRoomResponse; currentUserId: string; roomScope: 'main' | 'contributors' }) {
  const embed = useChymeEmbed();
  const entries = room.participants.map((participant) => toEntry(participant, room, currentUserId));
  return (
    <div className={styles.room}>
      <SeRoomStage entries={entries} extraListeners={room.guestCount} />
      <SeRoomJoinControls joining={embed?.joining ?? false} onJoin={() => embed?.join()} bringIn={roomScope === 'main' && room.viewer?.canBringSomeoneIn === true} />
      <SeRoomMoreSheet />
    </div>
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
