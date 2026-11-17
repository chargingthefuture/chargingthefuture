// The rooms at the top of Today on Android, the copy of the web's room-card.tsx: the Main Room card
// (MainRoomCard.tsx, the same card a visitor sees, with the member's buttons); and Weavers of the Commons as one row for the members who may enter it.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  SE_BROADCAST_WORDS as B,
  SE_TODAY_ROOM_WORDS as W,
  seBroadcastHostLine,
  seMainRoomButtons,
  seWeaversLine,
  type SeThemeTokens,
  type SeTodayBroadcast,
  type SeTodayRoom,
} from '@ctf/shared';
import { useBringSomeoneIn } from '../../../components/shared/useBringSomeoneIn';
import { useSeRooms } from '../rooms/SeRooms';
import { SE_FONT } from '../fonts';
import { MainRoomCard } from './MainRoomCard';

// The member's buttons, as on the web: Play readings opens the room and plays the readings loop
// there, Start a conversation opens it and joins the call; live, Listen in opens it and Bring
// someone in shares the signed-out Today.
function SignedInMainRoom({ t, room }: { t: SeThemeTokens; room: SeTodayRoom }) {
  const { open } = useSeRooms();
  const { note, bring } = useBringSomeoneIn();
  const buttons = seMainRoomButtons(room.live, true);
  const talk = room.nextTalk;
  return (
    <MainRoomCard
      t={t}
      room={room}
      buttons={buttons}
      onPrimary={() => open('main', talk, buttons.primary.action === 'readings' ? 'readings' : undefined)}
      onSecondary={() => (buttons.secondary.action === 'bring' ? void bring() : open('main', talk, 'join'))}
      note={note}
    />
  );
}

function WeaversRow({ t, room }: { t: SeThemeTokens; room: SeTodayRoom }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { open } = useSeRooms();
  return (
    <View style={s.weavers} accessibilityLabel={`${room.name} room`}>
      <View style={s.lock}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2} strokeLinecap="round">
          <Rect x={5} y={11} width={14} height={10} rx={2} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </Svg>
      </View>
      <View style={s.weaversText}>
        <Text style={s.name}>{room.name}</Text>
        <Text style={s.small}>{seWeaversLine(room)}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={() => open('contributors', null)} style={[s.quiet, s.quietSmall]}>
        <Text style={[s.quietLabel, s.quietLabelSmall]}>{W.open}</Text>
      </TouchableOpacity>
    </View>
  );
}

// The Main Room while a broadcast is on and nobody is in the room: one quiet row.
function QuietMainRoom({ t, room }: { t: SeThemeTokens; room: SeTodayRoom }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { open } = useSeRooms();
  return (
    <View style={s.weavers} accessibilityLabel={room.name}>
      <View style={s.weaversText}>
        <Text style={s.name}>
          {room.name} <Text style={s.meta}>· {W.mainAudience}</Text>
        </Text>
        <Text style={s.small}>{B.roomQuiet}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={() => open('main', room.nextTalk)} style={[s.quiet, s.quietSmall]}>
        <Text style={[s.quietLabel, s.quietLabelSmall]}>{W.open}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Opens the room inside the frame, so the call keeps running while the member reads Today.
// `broadcasting`: a broadcast is live, so a Main Room nobody is in shows as one quiet row.
export function RoomCard({ t, room, broadcasting = false }: { t: SeThemeTokens; room: SeTodayRoom; broadcasting?: boolean }) {
  if (room.key === 'weavers') return <WeaversRow t={t} room={room} />;
  return broadcasting && !room.live ? <QuietMainRoom t={t} room={room} /> : <SignedInMainRoom t={t} room={room} />;
}

// The broadcast card, the copy of the web's: the picture area with LIVE and a play button, who is
// broadcasting and since when, Watch and Chat. No watcher count, as on the web.
export function BroadcastCard({ t, broadcast, go }: { t: SeThemeTokens; broadcast: SeTodayBroadcast; go: (_href: string) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const hostLine = seBroadcastHostLine(broadcast);
  return (
    <View style={s.broadcast} accessibilityLabel="Live broadcast">
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${B.watch}: ${broadcast.title ?? B.label}`} onPress={() => go(broadcast.href)} style={s.picture}>
        <Text style={[s.liveBadge, s.pictureLive]}>LIVE</Text>
        <View style={s.play}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M8 5l12 7-12 7z" fill={t.hero} />
          </Svg>
        </View>
      </TouchableOpacity>
      <View style={s.broadcastBody}>
        <Text style={s.broadcastLabel}>{B.label.toUpperCase()}</Text>
        {broadcast.title ? <Text style={s.title}>{broadcast.title}</Text> : null}
        {hostLine ? <Text style={s.meta}>{hostLine}</Text> : null}
        <View style={s.buttons}>
          <TouchableOpacity accessibilityRole="button" onPress={() => go(broadcast.href)} style={s.primary}>
            <Text style={s.primaryLabel}>{B.watch}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => go(broadcast.href)} style={s.quiet}>
            <Text style={s.quietLabel}>{B.chat}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    liveBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: t.liveBadge, color: t.onLiveBadge, fontSize: 11, letterSpacing: 1.1, fontFamily: SE_FONT.sansBold },
    name: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    title: { fontSize: 21, lineHeight: 25, color: t.ink, fontFamily: SE_FONT.serif },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    small: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sans },
    buttons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    primary: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, boxShadow: `0px 3px 0px ${t.line}` },
    primaryLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    quiet: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair },
    quietSmall: { minHeight: 40, paddingHorizontal: 14 },
    quietLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    quietLabelSmall: { fontSize: 13 },
    weavers: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    lock: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: t.sunk },
    weaversText: { flex: 1 },
    broadcast: { overflow: 'hidden', borderRadius: 20, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    picture: { height: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: t.hero },
    pictureLive: { position: 'absolute', left: 12, top: 12 },
    play: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: t.onHero },
    broadcastBody: { gap: 8, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
    broadcastLabel: { fontSize: 12, letterSpacing: 1, color: t.soft, fontFamily: SE_FONT.sansBold },
  });
}
