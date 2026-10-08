/**
 * ChymeRoom — the Chyme screen on Android, drawn to match the web Chyme page at phone width
 * (web components/chyme/chyme-shell.tsx and what it renders). Under the app's screen header: the
 * rooms rail, the hosting statement, what is coming up on TI Radio, then the selected room.
 *
 * Every room the member has opened stays mounted and the others are hidden, as on the web, so
 * switching rooms never drops a live call. Back Channel's invite card, call card and notice are
 * drawn over the screen, outside the scrolling content, so they stay put while the room scrolls.
 *
 * The live audio needs native WebRTC code, so the in-room screen only works in an EAS dev or
 * production build, not in Expo Go (see app.config.ts).
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { chymeHandle, type ChymeRoomScope } from './ChymeApi';
import { useChymeTokens } from './chyme-tokens';
import { ChymeHostingNote, ChymeRoomsRail } from './chyme-rail';
import { ChymeUpcoming } from './chyme-upcoming';
import { ChymeLiveRoom } from './chyme-live-room';
import { ChymeBackChannelLayer } from './chyme-back-channel-layer';
import { useChymeBackChannel } from './useChymeBackChannel';

const SCOPES: ChymeRoomScope[] = ['main', 'contributors'];

export const ChymeRoom: React.FC = () => {
  const t = useChymeTokens();
  const { user } = useAuth();
  const currentUser = { userId: user?.id ?? '', username: user?.username ?? null };
  const [roomScope, setRoomScope] = useState<ChymeRoomScope>('main');
  const [mounted, setMounted] = useState<ReadonlySet<ChymeRoomScope>>(() => new Set<ChymeRoomScope>(['main']));
  const [backChannelEnabled, setBackChannelEnabled] = useState(false);
  const backChannel = useChymeBackChannel(backChannelEnabled);
  const onBackChannelEnabled = useCallback((enabled: boolean) => setBackChannelEnabled(enabled), []);

  const selectRoom = (scope: ChymeRoomScope) => {
    setMounted((current) => (current.has(scope) ? current : new Set([...current, scope])));
    setRoomScope(scope);
  };

  return (
    <View style={[styles.screen, { backgroundColor: t.BG }]}>
      <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled">
        <ChymeRoomsRail roomScope={roomScope} onSelect={selectRoom} />
        <ChymeHostingNote />
        <ChymeUpcoming />
        {SCOPES.map((scope) =>
          mounted.has(scope) ? (
            <View key={scope} style={scope === roomScope ? null : styles.hidden}>
              <ChymeLiveRoom
                scope={scope}
                user={currentUser}
                backChannel={backChannel}
                onBackChannelEnabled={scope === 'main' ? onBackChannelEnabled : undefined}
              />
            </View>
          ) : null,
        )}
      </ScrollView>
      {backChannelEnabled ? <ChymeBackChannelLayer controller={backChannel} displayName={chymeHandle(currentUser.username, currentUser.userId)} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // The app pads every screen's content area; the web Chyme page runs edge to edge under its
  // header, so this screen takes that padding back.
  screen: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
