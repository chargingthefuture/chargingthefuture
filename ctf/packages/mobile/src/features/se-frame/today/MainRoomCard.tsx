// The Main Room card on Today, the Android copy of the web's main-room-card.tsx: one card signed in
// and signed out (owner decision, 2026-11-17). The room's name and audience, the next talk with its
// host, time and Add to calendar, the faces and counts ("Quiet right now" when nobody is in), then
// two buttons whose words come from seMainRoomButtons. `inPlace` is what a visitor hears in the card
// itself (the readings, or the live room), shown where the first button was.

import React, { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  SE_MAIN_ROOM_CARD_WORDS as M,
  SE_TODAY_ROOM_WORDS as W,
  seRoomCountsLine,
  seTalkCalendarEvent,
  seTalkHostLine,
  type SeMainRoomButtons,
  type SeThemeTokens,
  type SeTodayRoom,
} from '@ctf/shared';
import { AddToCalendarButton } from '../../../components/shared/AddToCalendarButton';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { SE_FONT } from '../fonts';

type Styles = ReturnType<typeof makeStyles>;

function Faces({ s, faces }: { s: Styles; faces: string[] }) {
  if (faces.length === 0) return null;
  return (
    <View style={s.faces} importantForAccessibility="no-hide-descendants">
      {faces.map((id, index) => (
        <View key={id} style={[s.face, index > 0 ? s.faceOverlap : null]}>
          <SeAvatar accountId={id} size={30} />
        </View>
      ))}
    </View>
  );
}

type MainRoomCardProps = {
  t: SeThemeTokens;
  room: SeTodayRoom;
  buttons: SeMainRoomButtons;
  onPrimary: () => void;
  // Signed in: the second button's action; signed out: going to sign-up.
  onSecondary: () => void;
  inPlace?: ReactNode;
  note?: string | null;
};

export function MainRoomCard({ t, room, buttons, onPrimary, onSecondary, inPlace, note }: MainRoomCardProps) {
  const s = useMemo(() => makeStyles(t), [t]);
  const talk = room.nextTalk;
  const signUp = buttons.secondary.action === 'sign-up';
  return (
    <View style={s.card} accessibilityLabel={room.live ? M.liveLabel : room.name}>
      <View style={s.row}>
        {room.live ? <Text style={s.liveBadge}>LIVE</Text> : null}
        <Text style={s.name}>{room.name}</Text>
        <Text style={s.meta}>· {W.mainAudience}</Text>
      </View>
      {talk ? <Text style={s.title}>{talk.title}</Text> : null}
      {talk ? <Text style={s.meta}>{seTalkHostLine(talk)}</Text> : null}
      {talk && !talk.onAir ? <AddToCalendarButton color={t.ink} borderColor={t.line} event={seTalkCalendarEvent(talk)} /> : null}
      <View style={s.stage}>
        <Faces s={s} faces={room.faces} />
        <Text style={s.meta}>{seRoomCountsLine(room)}</Text>
      </View>
      {inPlace}
      <View style={s.buttons}>
        {inPlace ? null : (
          <TouchableOpacity accessibilityRole="button" onPress={onPrimary} style={s.primary}>
            <Text style={s.primaryLabel}>{buttons.primary.label}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole={signUp ? 'link' : 'button'} onPress={onSecondary} style={s.quiet}>
          <Text style={s.quietLabel}>{buttons.secondary.label}</Text>
        </TouchableOpacity>
      </View>
      {note ? (
        <Text accessibilityRole="alert" style={s.meta}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    liveBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: t.liveBadge, color: t.onLiveBadge, fontSize: 11, letterSpacing: 1.1, fontFamily: SE_FONT.sansBold },
    name: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    title: { fontSize: 21, lineHeight: 25, color: t.ink, fontFamily: SE_FONT.serif },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    stage: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    faces: { flexDirection: 'row' },
    face: { borderRadius: 999, borderWidth: 2, borderColor: t.card, overflow: 'hidden' },
    faceOverlap: { marginLeft: -10 },
    buttons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    primary: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, boxShadow: `0px 3px 0px ${t.line}` },
    primaryLabel: { fontSize: 15, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    quiet: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: t.hair },
    quietLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}
