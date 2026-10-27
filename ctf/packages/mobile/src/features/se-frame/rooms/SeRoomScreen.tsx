// One room inside the 3.1 frame, the Android copy of the web
// (web components/se-frame/rooms/se-room-screen.tsx): its own header, the talk that is on or next,
// the notice that guests may be listening, the quiet state, then the Chyme room itself in the 3.1
// words. The room's state lives here, so the call keeps running while the screen is hidden.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SE_ROOM_QUIET, SE_ROOM_QUIET_TEXT, seRoomView, seRoomWords, seTalkLine, type SeRoomView, type SeThemeTokens } from '@ctf/shared';
import { chymeHandle, type ChymeRoomScope } from '../../chyme/ChymeApi';
import { ChymeLiveRoomView } from '../../chyme/chyme-live-room';
import { ChymeReadingsPlayer } from '../../chyme/chyme-readings-player';
import { ChymeBackChannelLayer } from '../../chyme/chyme-back-channel-layer';
import { ChymeWordsProvider } from '../../chyme/chyme-words';
import { useChymeBackChannel } from '../../chyme/useChymeBackChannel';
import { useChymeRoomState } from '../../chyme/useChymeRoomState';
import type { CurrentUser } from '../../chyme/chyme-room-view';
import { SE_FONT } from '../fonts';
import { useSeRooms } from './SeRooms';

type Styles = ReturnType<typeof makeStyles>;

function RoomHeader({ s, view, onMinimize }: { s: Styles; view: SeRoomView; onMinimize: () => void }) {
  return (
    <View style={s.header}>
      <TouchableOpacity accessibilityRole="button" onPress={onMinimize} style={s.minimize}>
        <Text style={s.minimizeLabel}>⌄ {view.minimizeLabel}</Text>
      </TouchableOpacity>
      <Text accessibilityRole="header" style={s.title}>
        {view.name}
      </Text>
      <Text style={s.meta}>{view.audience}</Text>
      {view.talkLine ? <Text style={s.talk}>{view.talkLine}</Text> : null}
    </View>
  );
}

function RoomNotices({ s, view }: { s: Styles; view: SeRoomView }) {
  return (
    <>
      {view.joined && view.words.guestNotice ? <Text style={s.notice}>{view.words.guestNotice}</Text> : null}
      {view.quiet ? (
        <View style={s.quiet}>
          <Text style={s.quietTitle}>{SE_ROOM_QUIET}</Text>
          <Text style={s.quietText}>{SE_ROOM_QUIET_TEXT}</Text>
          <ChymeReadingsPlayer />
        </View>
      ) : null}
    </>
  );
}

// Back Channel runs from the Main Room; its invite and call cards are drawn over the room screen.
function useRoomBackChannel() {
  const [enabled, setEnabled] = useState(false);
  const controller = useChymeBackChannel(enabled);
  const onEnabled = useCallback((value: boolean) => setEnabled(value), []);
  return { enabled, controller, onEnabled };
}

function SeRoomScreen({ t, scope, user, visible }: { t: SeThemeTokens; scope: ChymeRoomScope; user: CurrentUser; visible: boolean }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { report, minimize, talks } = useSeRooms();
  const state = useChymeRoomState(scope);
  const backChannel = useRoomBackChannel();
  const room = state.room;
  const view = seRoomView(
    scope,
    { joined: state.call.joinState === 'ready', name: room ? room.roomName : null, count: room ? room.participants.length : null },
    seTalkLine(talks.main ?? null),
  );
  const leave = state.call.leave;
  const { joined, name } = view;
  const count = room ? room.participants.length : 0;

  useEffect(() => {
    report(scope, { joined, name, count }, () => void leave());
  }, [report, scope, joined, name, count, leave]);

  return (
    <View style={[s.root, visible ? null : s.hidden]} accessibilityLabel={view.name}>
      <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
        <RoomHeader s={s} view={view} onMinimize={minimize} />
        <RoomNotices s={s} view={view} />
        <View style={s.room}>
          <ChymeWordsProvider words={view.words}>
            <ChymeLiveRoomView
              state={state}
              scope={scope}
              user={user}
              backChannel={backChannel.controller}
              onBackChannelEnabled={scope === 'main' ? backChannel.onEnabled : undefined}
            />
          </ChymeWordsProvider>
        </View>
      </ScrollView>
      {backChannel.enabled ? <ChymeBackChannelLayer controller={backChannel.controller} displayName={chymeHandle(user.username, user.userId)} /> : null}
    </View>
  );
}

// Every room the member has open, mounted; only the one being looked at is visible.
export function SeRoomHosts({ t, user }: { t: SeThemeTokens; user: CurrentUser }) {
  const { opened, shown } = useSeRooms();
  return (
    <>
      {opened.map((scope) => (
        <SeRoomScreen key={scope} t={t} scope={scope} user={user} visible={shown === scope} />
      ))}
    </>
  );
}

// The room in the call, while the member is somewhere else in the app.
export function SeRoomBar({ t }: { t: SeThemeTokens }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { opened, shown, summaries, open, leave } = useSeRooms();
  const scope = opened.find((item) => summaries[item]?.joined && item !== shown);
  if (!scope) return null;
  const summary = summaries[scope];
  const words = seRoomWords(scope);
  return (
    <View style={s.bar} accessibilityLabel="Room you are in">
      <TouchableOpacity accessibilityRole="button" onPress={() => open(scope)} style={s.barOpen}>
        <View style={s.barDot} />
        <Text numberOfLines={1} style={s.barName}>
          {summary?.name}
        </Text>
        <Text style={s.barCount}>{summary?.count ?? 0} here</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => leave(scope)} style={s.barLeave}>
        <Text style={s.barLeaveLabel}>{words.leave}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    hidden: { display: 'none' },
    screen: { gap: 14, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 180 },
    header: { gap: 4 },
    minimize: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    minimizeLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    title: { fontSize: 28, lineHeight: 31, color: t.ink, fontFamily: SE_FONT.serif },
    meta: { fontSize: 14, color: t.soft, fontFamily: SE_FONT.sans },
    talk: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    notice: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.hair,
      backgroundColor: t.card,
      fontSize: 14,
      lineHeight: 20,
      color: t.ink,
      fontFamily: SE_FONT.sans,
    },
    quiet: { gap: 8, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    quietTitle: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    quietText: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    room: { overflow: 'hidden', borderRadius: 18, borderWidth: 1.5, borderColor: t.hair },
    bar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 96,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      paddingLeft: 14,
      paddingRight: 6,
      borderRadius: 999,
      backgroundColor: t.card,
      borderWidth: 1.5,
      borderColor: t.line,
      boxShadow: `0px 3px 0px ${t.line}`,
    },
    barOpen: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
    barDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.liveBadge },
    barName: { flexShrink: 1, fontSize: 14, color: t.ink, fontFamily: SE_FONT.sansBold },
    barCount: { fontSize: 13, color: t.soft, fontFamily: SE_FONT.sans },
    barLeave: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg },
    barLeaveLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
  });
}
