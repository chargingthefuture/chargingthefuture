// One room inside the 3.1 frame, the Android copy of the web
// (web components/se-frame/rooms/se-room-screen.tsx), to the board "Live room": the header
// (SeRoomHeader.tsx), the quiet state, then the Chyme room drawn to the board
// (features/chyme/se-room/). The room's state lives here, so the call keeps running while the screen
// is hidden.

import React, { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SE_ROOM_QUIET, SE_ROOM_QUIET_TEXT, seRoomBarLine, seRoomView, type SeRoomView, type SeThemeTokens } from '@ctf/shared';
import { chymeHandle, type ChymeRoomScope } from '../../chyme/ChymeApi';
import { ChymeLiveRoomView } from '../../chyme/chyme-live-room';
import { ChymeReadingsPlayer } from '../../chyme/chyme-readings-player';
import { ChymeBackChannelLayer } from '../../chyme/chyme-back-channel-layer';
import { ChymeEmbedContext, type ChymeEmbed, type ChymeLiveSummary } from '../../chyme/chyme-embed';
import { ChymeTokensContext, seChymeTokens } from '../../chyme/chyme-tokens';
import { ChymeWordsProvider } from '../../chyme/chyme-words';
import { useChymeBackChannel } from '../../chyme/useChymeBackChannel';
import { useChymeRoomState } from '../../chyme/useChymeRoomState';
import type { CurrentUser } from '../../chyme/chyme-room-view';
import { SE_FONT } from '../fonts';
import { useSeRooms, type SeRoomSummary } from './SeRooms';
import { SeRoomHeader } from './SeRoomHeader';

export { SeRoomBar } from './SeRoomBar';

type Styles = ReturnType<typeof makeStyles>;

function QuietState({ s, view }: { s: Styles; view: SeRoomView }) {
  if (!view.quiet) return null;
  return (
    <View style={s.quiet}>
      <Text style={s.quietTitle}>{SE_ROOM_QUIET}</Text>
      <Text style={s.quietText}>{SE_ROOM_QUIET_TEXT}</Text>
      <ChymeReadingsPlayer />
    </View>
  );
}

// Back Channel runs from the Main Room; its invite and call cards are drawn over the room screen.
function useRoomBackChannel() {
  const [enabled, setEnabled] = useState(false);
  const controller = useChymeBackChannel(enabled);
  const onEnabled = useCallback((value: boolean) => setEnabled(value), []);
  return { enabled, controller, onEnabled };
}

function barSummary(view: SeRoomView, count: number, live: ChymeLiveSummary | null): SeRoomSummary {
  return {
    joined: view.joined,
    name: view.name,
    count,
    title: view.heading,
    line: live ? seRoomBarLine(live.speakers.map((speaker) => speaker.name), live.selfSpeaking) : `${count} here`,
    faces: live ? live.speakers.slice(0, 2).map((speaker) => speaker.id) : [],
    canRaiseHand: Boolean(live?.canRaiseHand),
    handRaised: Boolean(live?.handRaised),
  };
}

// Keeps the room bar told what this room is doing, and how to leave it and raise a hand from there.
function useBarReport(scope: ChymeRoomScope, summary: SeRoomSummary, leave: () => Promise<void>, handToggle: MutableRefObject<(() => void) | null>) {
  const { report } = useSeRooms();
  const key = JSON.stringify(summary);
  useEffect(() => {
    report(scope, JSON.parse(key) as SeRoomSummary, { leave: () => void leave(), toggleHand: () => handToggle.current?.() });
  }, [report, scope, key, leave, handToggle]);
}

// The room's view and its count, from the room read (null until it arrives) and the talk on Today.
function useRoomView(scope: ChymeRoomScope, state: ReturnType<typeof useChymeRoomState>) {
  const { talks } = useSeRooms();
  const room = state.room;
  const joined = state.call.joinState === 'ready';
  const count = room ? room.participants.length : null;
  const view = seRoomView(scope, { joined, name: room ? room.roomName : null, count }, talks.main ?? null);
  return { view, count: count ?? 0, live: joined || Boolean(room?.callActive) };
}

function SeRoomScreen({ t, scope, user, visible }: { t: SeThemeTokens; scope: ChymeRoomScope; user: CurrentUser; visible: boolean }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { minimize } = useSeRooms();
  const state = useChymeRoomState(scope);
  const backChannel = useRoomBackChannel();
  const [moreOpen, setMoreOpen] = useState(false);
  const [live, setLive] = useState<ChymeLiveSummary | null>(null);
  const handToggle = useRef<(() => void) | null>(null);
  const room = state.room;
  const { view, count, live: liveNow } = useRoomView(scope, state);
  useBarReport(scope, barSummary(view, count, live), state.call.leave, handToggle);

  const embed: ChymeEmbed = {
    t,
    moreOpen,
    setMoreOpen,
    refresh: () => void state.refresh(),
    refreshing: state.refreshing,
    join: () => void state.call.join(),
    joining: state.call.joinState === 'joining',
    reportLive: setLive,
    handToggle,
  };

  return (
    <View style={[s.root, visible ? null : s.hidden]} accessibilityLabel={view.name}>
      <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
        <SeRoomHeader
          t={t}
          view={view}
          live={liveNow}
          startedAtIso={live?.startedAtIso ?? null}
          onBack={minimize}
          onMore={room ? () => setMoreOpen(true) : null}
        />
        <QuietState s={s} view={view} />
        <ChymeEmbedContext.Provider value={embed}>
          <ChymeWordsProvider words={view.words}>
            <ChymeLiveRoomView
              state={state}
              scope={scope}
              user={user}
              backChannel={backChannel.controller}
              onBackChannelEnabled={scope === 'main' ? backChannel.onEnabled : undefined}
              embedded
            />
          </ChymeWordsProvider>
        </ChymeEmbedContext.Provider>
      </ScrollView>
      {backChannel.enabled ? <ChymeBackChannelLayer controller={backChannel.controller} displayName={chymeHandle(user.username, user.userId)} /> : null}
    </View>
  );
}

// Every room the member has open, mounted; only the one being looked at is visible.
export function SeRoomHosts({ t, user }: { t: SeThemeTokens; user: CurrentUser }) {
  const { opened, shown } = useSeRooms();
  // Chyme's parts (the readings loop, the stage, the call) drawn in the member's 3.1 colors.
  const tokens = useMemo(() => seChymeTokens(t), [t]);
  return (
    <ChymeTokensContext.Provider value={tokens}>
      {opened.map((scope) => (
        <SeRoomScreen key={scope} t={t} scope={scope} user={user} visible={shown === scope} />
      ))}
    </ChymeTokensContext.Provider>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    hidden: { display: 'none' },
    screen: { gap: 16, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 180 },
    quiet: { gap: 8, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    quietTitle: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    quietText: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
  });
}
