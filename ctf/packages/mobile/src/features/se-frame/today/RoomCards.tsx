// The rooms at the top of Today on Android, the copy of the web's room-card.tsx, to the approved
// board: the Main Room card with its talk, who hosts it and when, the faces on the stage, Listen in
// and Bring someone in; and Weavers of the Commons as one row for the members who may enter it.

import React, { useMemo, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  SE_TODAY_ROOM_WORDS as W,
  seRoomCountsLine,
  seTalkCalendarEvent,
  seTalkHostLine,
  seWeaversLine,
  type SeThemeTokens,
  type SeTodayRoom,
} from '@ctf/shared';
import { AddToCalendarButton } from '../../../components/shared/AddToCalendarButton';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { webPageUrl } from '../../../navigation/openWebPage';
import { reportError } from '../../../observability/report';
import { useSeRooms } from '../rooms/SeRooms';
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

// "Bring someone in" opens the phone's share sheet with the signed-out Today, where anybody can
// listen without an account.
function useBringSomeoneIn() {
  const [note, setNote] = useState<string | null>(null);
  const bring = async () => {
    try {
      await Share.share({ message: `${W.bringText} ${webPageUrl(W.bringPath)}` });
    } catch (error) {
      reportError(error, { area: 'today', op: 'bring_someone_in' });
      setNote(W.copyFailed);
    }
  };
  return { note, bring };
}

function MainRoomCard({ t, room }: { t: SeThemeTokens; room: SeTodayRoom }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { open } = useSeRooms();
  const { note, bring } = useBringSomeoneIn();
  const talk = room.nextTalk;
  return (
    <View style={s.card} accessibilityLabel={room.live ? 'Live room' : room.name}>
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
      <View style={s.buttons}>
        <TouchableOpacity accessibilityRole="button" onPress={() => open('main', talk)} style={s.primary}>
          <Text style={s.primaryLabel}>{W.listen}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => void bring()} style={s.quiet}>
          <Text style={s.quietLabel}>{W.bring}</Text>
        </TouchableOpacity>
      </View>
      {note ? <Text style={s.meta}>{note}</Text> : null}
    </View>
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

// Opens the room inside the frame, so the call keeps running while the member reads Today.
export function RoomCard({ t, room }: { t: SeThemeTokens; room: SeTodayRoom }) {
  return room.key === 'weavers' ? <WeaversRow t={t} room={room} /> : <MainRoomCard t={t} room={room} />;
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    liveBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden', backgroundColor: t.liveBadge, color: t.onLiveBadge, fontSize: 11, letterSpacing: 1.1, fontFamily: SE_FONT.sansBold },
    name: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    title: { fontSize: 21, lineHeight: 25, color: t.ink, fontFamily: SE_FONT.serif },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    small: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sans },
    stage: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    faces: { flexDirection: 'row' },
    face: { borderRadius: 999, borderWidth: 2, borderColor: t.card, overflow: 'hidden' },
    faceOverlap: { marginLeft: -10 },
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
  });
}
