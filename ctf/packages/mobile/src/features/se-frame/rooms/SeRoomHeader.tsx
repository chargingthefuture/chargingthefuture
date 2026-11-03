// The top of the live room, the Android copy of the web (web components/se-frame/rooms/
// se-room-header.tsx), to the board "Live room": Back to Today, LIVE and since when, More; then which
// room and who it is for, the title, who hosts the talk and when, and the room rule, short until
// "Read it" opens it in place.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_LIVE_ROOM_WORDS as W, seRoomSince, type SeRoomView, type SeThemeTokens } from '@ctf/shared';
import { SeRoomIcon } from '../../chyme/se-room/SeRoomIcon';
import { SE_FONT } from '../fonts';

type Styles = ReturnType<typeof makeStyles>;

function RoomRule({ s, view }: { s: Styles; view: SeRoomView }) {
  const [open, setOpen] = useState(false);
  return (
    <Text style={s.rule}>
      {open ? view.rule : view.ruleShort}{' '}
      <Text accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={s.ruleToggle}>
        {open ? W.hideRule : W.readRule}
      </Text>
    </Text>
  );
}

function Eyebrow({ s, view }: { s: Styles; view: SeRoomView }) {
  if (!view.eyebrowName) return <Text style={s.audience}>{view.audience}</Text>;
  return (
    <Text style={s.eyebrow}>
      {view.eyebrowName} <Text style={s.audience}>· {view.audience}</Text>
    </Text>
  );
}

export type SeRoomHeaderProps = {
  t: SeThemeTokens;
  view: SeRoomView;
  live: boolean;
  startedAtIso: string | null;
  onBack: () => void;
  // Null until the room is read: the More sheet is drawn by the room.
  onMore: (() => void) | null;
};

export function SeRoomHeader({ t, view, live, startedAtIso, onBack, onMore }: SeRoomHeaderProps) {
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={s.header}>
      <View style={s.topRow}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={view.backLabel} onPress={onBack} style={s.round}>
          <SeRoomIcon name="back" size={18} strokeWidth={2.2} color={t.ink} />
        </TouchableOpacity>
        {live ? (
          <View style={s.liveBadge}>
            <Text style={s.liveText}>{W.live}</Text>
          </View>
        ) : null}
        {live && startedAtIso ? <Text style={s.since}>{seRoomSince(startedAtIso)}</Text> : null}
        <View style={s.grow} />
        {onMore ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.more} onPress={onMore} style={s.round}>
            <SeRoomIcon name="more" size={18} color={t.ink} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={s.titles}>
        <Eyebrow s={s} view={view} />
        <Text accessibilityRole="header" style={s.title}>
          {view.heading}
        </Text>
        {view.talkLine ? <Text style={s.meta}>{view.talkLine}</Text> : null}
        <RoomRule s={s} view={view} />
      </View>
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    header: { gap: 16 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card },
    liveBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: t.liveBadge },
    liveText: { fontSize: 11, letterSpacing: 1.1, color: t.onLiveBadge, fontFamily: SE_FONT.sansBold },
    since: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    grow: { flex: 1 },
    titles: { gap: 8 },
    eyebrow: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    audience: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    title: { fontSize: 26, lineHeight: 31, color: t.ink, fontFamily: SE_FONT.serif },
    meta: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    rule: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: t.sunk, fontSize: 13, lineHeight: 18, color: t.soft, fontFamily: SE_FONT.sans },
    ruleToggle: { color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
  });
}
