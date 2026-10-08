// One participant on the live stage, copied from the web room (web components/chyme/
// chyme-audio-room.tsx ChymeSpeakerTile): the round avatar with its microphone badge and raised hand,
// the name, the speaking / muted / listening pill, and under another member's tile Tip, Back
// Channel and, for an admin, the moderation actions.


import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Headphones, Mic } from 'lucide-react-native';
import { SfuModels, type StreamVideoParticipant } from '@stream-io/video-react-native-sdk';
import { interFamily } from '../../components/ui';
import { ChymeTipButton } from './ChymeTipModal';
import { ChymeBackChannelButton } from './chyme-back-channel-layer';
import { ChymeModeratorActions, type MobileModerationContext } from './ChymeModeration';
import type { MobileBackChannelController } from './useChymeBackChannel';
import { initials, useChymeTokens } from './chyme-tokens';

export function isPublishingAudio(participant: StreamVideoParticipant): boolean {
  return participant.publishedTracks.includes(SfuModels.TrackType.AUDIO);
}

type AvatarProps = { name: string; speaking: boolean; isSelf: boolean; isGuest: boolean; audioActive: boolean; handRaised: boolean };

function ringColor(accent: string, speaking: boolean, isSelf: boolean): string {
  if (speaking) return accent;
  return isSelf ? `${accent}80` : 'transparent';
}

// The web's glow: strong while speaking, faint on the member's own tile.
function glow(accent: string, speaking: boolean, isSelf: boolean): string | undefined {
  if (speaking) return `0 0 20px ${accent}80`;
  return isSelf ? `0 0 12px ${accent}40` : undefined;
}

export function SpeakerAvatar({ name, speaking, isSelf, isGuest, audioActive, handRaised }: AvatarProps) {
  const t = useChymeTokens();
  return (
    <View>
      <View style={[styles.avatar, { borderRadius: t.radius(36), backgroundColor: `${t.ACCENT}20`, borderColor: ringColor(t.ACCENT, speaking, isSelf), boxShadow: glow(t.ACCENT, speaking, isSelf) }]}>
        <Text style={[styles.initials, { color: t.ACCENT }]}>{initials(name)}</Text>
      </View>
      <View style={[styles.micBadge, { borderRadius: t.radius(11), backgroundColor: audioActive ? t.ACCENT : 'rgba(120,120,120,0.9)' }]}>
        {isGuest ? <Headphones size={10} color="#fff" style={styles.guestIcon} /> : <Mic size={10} color="#fff" style={{ opacity: audioActive ? 1 : 0.5 }} />}
      </View>
      {handRaised ? (
        <Text accessibilityLabel="hand raised" style={styles.hand}>
          ✋
        </Text>
      ) : null}
    </View>
  );
}

function statusLabel(isGuest: boolean, audioActive: boolean): string {
  if (isGuest) return 'listening';
  return audioActive ? 'speaking' : 'muted';
}

export function StatusBadge({ isGuest, audioActive }: { isGuest: boolean; audioActive: boolean }) {
  const t = useChymeTokens();
  return (
    <View
      style={[
        styles.status,
        {
          borderRadius: t.radius(20),
          backgroundColor: audioActive ? `${t.ACCENT}20` : 'rgba(255,255,255,0.05)',
          borderColor: audioActive ? `${t.ACCENT}35` : 'transparent',
        },
      ]}
    >
      <Text style={[styles.statusText, { color: audioActive ? t.ACCENT : t.MUTED }]}>{statusLabel(isGuest, audioActive)}</Text>
    </View>
  );
}

type TileActionsProps = {
  clerkUserId: string;
  name: string;
  backChannel: MobileBackChannelController | null;
  moderation: MobileModerationContext;
};

function TileActions({ clerkUserId, name, backChannel, moderation }: TileActionsProps) {
  return (
    <>
      <View style={styles.actions}>
        <ChymeTipButton recipientUserId={clerkUserId} recipientName={name} />
        {backChannel ? <ChymeBackChannelButton recipientUserId={clerkUserId} controller={backChannel} /> : null}
      </View>
      {moderation.viewer.isAdmin ? <ChymeModeratorActions clerkUserId={clerkUserId} name={name} moderation={moderation} /> : null}
    </>
  );
}

// Everything a tile shows, worked out from the participant. A guest joins as `chyme-guest-…`, never
// publishes and never shows a hand. Everyone else's hand comes from the server's set keyed by clerk
// user id (Stream ids are `chyme-<clerkUserId>`); the member's own from their own toggle.
function tileState(participant: StreamVideoParticipant, localHandRaised: boolean, raisedHandUserIds: ReadonlySet<string>) {
  const isSelf = Boolean(participant.isLocalParticipant);
  const isGuest = participant.userId.startsWith('chyme-guest-');
  const clerkUserId = participant.userId.startsWith('chyme-') ? participant.userId.slice('chyme-'.length) : participant.userId;
  const handRaised = isSelf ? localHandRaised : !isGuest && raisedHandUserIds.has(clerkUserId);
  return {
    isSelf,
    isGuest,
    clerkUserId,
    handRaised,
    audioActive: !isGuest && isPublishingAudio(participant),
    name: participant.name || participant.userId,
  };
}

export function ChymeSpeakerTile({
  participant,
  localHandRaised,
  raisedHandUserIds,
  backChannel,
  moderation,
}: {
  participant: StreamVideoParticipant;
  localHandRaised: boolean;
  raisedHandUserIds: ReadonlySet<string>;
  backChannel: MobileBackChannelController | null;
  moderation: MobileModerationContext;
}) {
  const t = useChymeTokens();
  const s = tileState(participant, localHandRaised, raisedHandUserIds);
  return (
    <View style={styles.tile}>
      <SpeakerAvatar name={s.name} speaking={participant.isSpeaking} isSelf={s.isSelf} isGuest={s.isGuest} audioActive={s.audioActive} handRaised={s.handRaised} />
      <Text style={[styles.name, { color: t.TEXT }]}>{s.name}</Text>
      <StatusBadge isGuest={s.isGuest} audioActive={s.audioActive} />
      {!s.isSelf && !s.isGuest ? <TileActions clerkUserId={s.clerkUserId} name={s.name} backChannel={backChannel} moderation={moderation} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', gap: 8, width: 100 },
  avatar: { width: 72, height: 72, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, fontFamily: interFamily('800') },
  micBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#021006',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestIcon: { opacity: 0.85 },
  hand: { position: 'absolute', top: -6, right: -6, fontSize: 16 },
  name: { fontSize: 12, textAlign: 'center', fontFamily: interFamily('600') },
  status: { paddingHorizontal: 8, paddingVertical: 1, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: interFamily('400') },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
});
