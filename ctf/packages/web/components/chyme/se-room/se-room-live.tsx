'use client';

import { useEffect, type ReactNode } from 'react';
import { ParticipantsAudio, SfuModels, useCallStateHooks, type StreamVideoParticipant } from '@stream-io/video-react-sdk';
import { SE_LIVE_ROOM_WORDS as W, seRoomName, seRoomOnStage, type SeBringIn } from '@ctf/shared';
import { useChymeEmbed, type ChymeLiveSummary } from '../chyme-embed';
import { useChymeWords } from '../chyme-words';
import { ChymeSpeakModeToggle, chymeSpeakRules, useMicOffWhileListening, type ChymeModerationContext } from '../chyme-moderation';
import type { ChymeConnectionState } from '../chyme-audio-room';
import { SeRoomStage, type SeStageEntry } from './se-room-stage';
import { SeRoomControls } from './se-room-controls';
import { SeRoomMoreSheet, SeRoomNotice, type SeRoomPerson } from './se-room-more';
import styles from './se-room.module.css';

// The live call inside the 3.1 room screen, to the "Live room" board. Everything it reads comes
// from the same Stream call and room state the 3.0 layout uses (chyme-audio-room.tsx); only the
// drawing differs. The per-person actions that sat under each 3.0 tile are in the More sheet.

type SeRoomLiveProps = {
  participants: StreamVideoParticipant[];
  audible: StreamVideoParticipant[];
  connection: ChymeConnectionState;
  handRaised: boolean;
  onToggleHand: () => void;
  raisedHandUserIds: ReadonlySet<string>;
  moderation: ChymeModerationContext;
  onLeave: () => void;
  mutesError: string | null;
  bringIn: SeBringIn;
  renderActions: (clerkUserId: string, name: string) => ReactNode;
};

// Stream ids are `chyme-<account id>`; signed-out guests are `chyme-guest-…`.
function accountIdOf(streamUserId: string): string {
  return streamUserId.startsWith('chyme-') ? streamUserId.slice('chyme-'.length) : streamUserId;
}

function isGuestId(streamUserId: string): boolean {
  return streamUserId.startsWith('chyme-guest-');
}

function displayName(participant: StreamVideoParticipant, guest: boolean): string {
  if (participant.isLocalParticipant) return W.you;
  if (guest) return W.guest;
  return seRoomName(participant.name || participant.userId);
}

function toEntry(participant: StreamVideoParticipant, props: SeRoomLiveProps): SeStageEntry {
  const guest = isGuestId(participant.userId);
  const accountId = accountIdOf(participant.userId);
  const micOn = !guest && participant.publishedTracks.includes(SfuModels.TrackType.AUDIO);
  const role = props.moderation.memberRoles.get(accountId) ?? null;
  const handRaised = participant.isLocalParticipant ? props.handRaised : !guest && props.raisedHandUserIds.has(accountId);
  return {
    key: participant.userId,
    accountId,
    name: displayName(participant, guest),
    onStage: seRoomOnStage({ micOn, guest, role }, props.moderation.speakMode),
    micOn,
    talking: participant.isSpeaking,
    handRaised: Boolean(handRaised),
  };
}

// Tells the room screen what the call is doing (for "Since" and the room bar), and lets the bar
// raise the member's hand.
function useReportLive(summary: ChymeLiveSummary, onToggleHand: () => void) {
  const embed = useChymeEmbed();
  const key = JSON.stringify(summary);
  const report = embed?.reportLive;
  useEffect(() => {
    report?.(JSON.parse(key) as ChymeLiveSummary);
  }, [report, key]);
  useEffect(() => () => report?.(null), [report]);
  useEffect(() => {
    if (!embed) return;
    embed.handToggle.current = onToggleHand;
  });
}

function ConnectionLine({ connection, mutesError }: { connection: ChymeConnectionState; mutesError: string | null }) {
  return (
    <>
      {connection === 'joined' ? null : <SeRoomNotice warn>{connection === 'lost' ? W.connectionLost : W.reconnecting}</SeRoomNotice>}
      {mutesError ? <SeRoomNotice warn>{mutesError}</SeRoomNotice> : null}
    </>
  );
}

function morePeople(participants: StreamVideoParticipant[], entries: SeStageEntry[], renderActions: SeRoomLiveProps['renderActions']): SeRoomPerson[] {
  return participants
    .map((participant, index) => ({ participant, entry: entries[index] }))
    .filter(({ participant }) => !participant.isLocalParticipant && !isGuestId(participant.userId))
    .map(({ entry }) => ({ key: entry.key, accountId: entry.accountId, name: entry.name, actions: renderActions(entry.accountId, entry.name) }));
}

export function SeRoomLive(props: SeRoomLiveProps) {
  const { participants, moderation } = props;
  const { useMicrophoneState, useCallStartedAt } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  const startedAt = useCallStartedAt();
  const { beforeUnlock, listening } = chymeSpeakRules(moderation);
  useMicOffWhileListening(listening, microphone);
  const words = useChymeWords();
  const entries = participants.map((participant) => toEntry(participant, props));
  const speakers = entries.filter((entry, index) => entry.micOn && !participants[index].isLocalParticipant).map((entry) => ({ id: entry.accountId, name: entry.name }));
  useReportLive(
    { startedAtIso: startedAt ? startedAt.toISOString() : null, speakers, selfSpeaking: !isMute, handRaised: props.handRaised, canRaiseHand: !beforeUnlock },
    props.onToggleHand,
  );

  return (
    <div className={styles.room}>
      <ConnectionLine connection={props.connection} mutesError={props.mutesError} />
      <SeRoomStage entries={entries} />
      {listening ? <SeRoomNotice>{beforeUnlock ? W.listenOnlyUnlock : W.listenOnlyHandRaise}</SeRoomNotice> : null}
      {words.guestNotice ? <span className={styles.guests}>{words.guestNotice}</span> : null}
      <SeRoomControls
        onLeave={props.onLeave}
        bringIn={props.bringIn}
        hand={beforeUnlock ? undefined : { raised: props.handRaised, onToggle: props.onToggleHand }}
        mic={{ muted: isMute, onToggle: () => void microphone.toggle(), disabled: listening }}
      />
      {/* Plays every participant's audio track except people this member muted. */}
      <ParticipantsAudio participants={props.audible} />
      <SeRoomMoreSheet admin={moderation.viewer.isAdmin ? <ChymeSpeakModeToggle moderation={moderation} /> : undefined} people={morePeople(participants, entries, props.renderActions)} />
    </div>
  );
}

// While the call connects, or when it could not: what happened, and Leave quietly.
export function SeRoomPending({ onLeave, children }: { onLeave: () => void; children: ReactNode }) {
  return (
    <div className={styles.room}>
      <SeRoomNotice>{children}</SeRoomNotice>
      <SeRoomControls onLeave={onLeave} bringIn="none" />
      <SeRoomMoreSheet />
    </div>
  );
}
