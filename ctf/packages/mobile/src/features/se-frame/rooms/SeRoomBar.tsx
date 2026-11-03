// The room in the call, while the member is somewhere else in the app, the Android copy of the web
// (web components/se-frame/rooms/se-room-bar.tsx), to the board "Room bar while browsing": who is
// speaking, the talk's title, who speaks and that the member listens, Raise hand and Leave quietly.
// Tapping the title opens the room again.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_LIVE_ROOM_WORDS as W, seRoomWords, type SeThemeTokens } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { SeRoomIcon } from '../../chyme/se-room/SeRoomIcon';
import { SE_FONT } from '../fonts';
import { useSeRooms } from './SeRooms';

export function SeRoomBar({ t }: { t: SeThemeTokens }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { opened, shown, summaries, open, leave, toggleHand } = useSeRooms();
  const scope = opened.find((item) => summaries[item]?.joined && item !== shown);
  const summary = scope ? summaries[scope] : undefined;
  if (!scope || !summary) return null;
  const words = seRoomWords(scope);
  return (
    <View style={s.bar} accessibilityLabel="Room you are in">
      {summary.faces.length > 0 ? (
        <View style={s.faces} importantForAccessibility="no-hide-descendants">
          {summary.faces.map((id, index) => (
            <View key={id} style={[s.face, index > 0 ? s.faceOverlap : null]}>
              <SeAvatar accountId={id} size={30} />
            </View>
          ))}
        </View>
      ) : null}
      <TouchableOpacity accessibilityRole="button" onPress={() => open(scope)} style={s.open}>
        <Text numberOfLines={1} style={s.name}>
          {summary.title}
        </Text>
        <Text numberOfLines={1} style={s.line}>
          {summary.line}
        </Text>
      </TouchableOpacity>
      {summary.canRaiseHand ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={summary.handRaised ? W.lowerHand : W.raiseHand}
          accessibilityState={{ selected: summary.handRaised }}
          onPress={() => toggleHand(scope)}
          style={[s.hand, summary.handRaised ? s.handOn : null]}
        >
          <SeRoomIcon name="hand" size={18} color={summary.handRaised ? t.onPick : t.bg} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={words.leave} onPress={() => leave(scope)} style={s.leave}>
        <SeRoomIcon name="close" size={16} strokeWidth={2.4} color={t.ink} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 100,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingLeft: 12,
      paddingRight: 10,
      borderRadius: 20,
      backgroundColor: t.ink,
      boxShadow: '0px 3px 0px #000',
    },
    faces: { flexDirection: 'row' },
    face: { borderRadius: 999, borderWidth: 2, borderColor: t.ink, overflow: 'hidden' },
    faceOverlap: { marginLeft: -10 },
    open: { flex: 1, minHeight: 44, justifyContent: 'center', gap: 1 },
    name: { fontSize: 14, color: t.bg, fontFamily: SE_FONT.sansBold },
    line: { fontSize: 12, color: t.bg, opacity: 0.8, fontFamily: SE_FONT.sans },
    hand: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: `${t.bg}4D` },
    handOn: { borderColor: t.pick, backgroundColor: t.pick },
    leave: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
  });
}
