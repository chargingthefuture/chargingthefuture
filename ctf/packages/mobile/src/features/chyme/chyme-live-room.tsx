// One room on the Chyme screen, copied from the web (web components/chyme/chyme-live-shell.tsx):
// the Join row, then the error banner, the "Join a Room" prompt when no room could be read, or the
// room itself. The private Weavers of the Commons room shows the "how it's earned" explainer to a
// member who has not earned it, never a locked or missing state.

import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Radio } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import type { ChymeRoomScope } from './ChymeApi';
import { openWebPath, useChymeTokens, type ChymeTokens } from './chyme-tokens';
import { useChymeRoomState } from './useChymeRoomState';
import { ChymeJoinBar } from './chyme-join-bar';
import { ChymeRoomView, type CurrentUser } from './chyme-room-view';
import { ChymeReadingsPlayer } from './chyme-readings-player';
import { WeaversBadge } from './weavers-badge';
import type { MobileBackChannelController } from './useChymeBackChannel';

function LockedExplainer({ t }: { t: ChymeTokens }) {
  return (
    <View style={[styles.locked, { backgroundColor: t.BG }]}>
      <View style={styles.lockedInner}>
        <WeaversBadge size={40} />
        <Text style={[styles.lockedTitle, { color: t.TITLE }]}>Weavers of the Commons</Text>
        <Text style={[styles.lockedBody, { color: t.FAINT }]}>
          This is a private audio room for consistent, broad contributors to the community — real help, delivered over time. Anyone can earn it; when you do, the room opens here.
        </Text>
        <Text accessibilityRole="link" onPress={() => openWebPath('/apps/directory/weavers-of-the-commons')} style={[styles.lockedLink, { color: t.ACCENT }]}>
          How it’s earned →
        </Text>
      </View>
    </View>
  );
}

function ErrorBanner({ error, t }: { error: string; t: ChymeTokens }) {
  return (
    <View style={[styles.error, { borderRadius: t.radius(12) }]}>
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
}

function JoinRoomPrompt({ t }: { t: ChymeTokens }) {
  return (
    <View style={styles.prompt}>
      <View style={[styles.promptIcon, { borderRadius: t.radius(24), backgroundColor: `${t.ACCENT}18`, borderColor: `${t.ACCENT}35` }]}>
        <Radio size={36} color={t.ACCENT} />
      </View>
      <Text style={[styles.promptTitle, { color: t.TITLE }]}>Join a Room</Text>
      <Text style={[styles.promptBody, { color: t.FAINT }]}>
        Select a live room to listen, speak, and connect with survivors worldwide. All rooms are members-only.
      </Text>
      <View style={styles.promptReadings}>
        <ChymeReadingsPlayer />
      </View>
    </View>
  );
}

export function ChymeLiveRoom({
  scope,
  user,
  backChannel,
  onBackChannelEnabled,
}: {
  scope: ChymeRoomScope;
  user: CurrentUser;
  backChannel: MobileBackChannelController | null;
  onBackChannelEnabled?: (_enabled: boolean) => void;
}) {
  const t = useChymeTokens();
  const state = useChymeRoomState(scope);
  const { room, call } = state;
  // Back Channel runs in the main room while joined and while the quota policy allows it.
  const backChannelEnabled = scope === 'main' && call.joinState === 'ready' && room?.quota.backChannelAllowed === true;
  useEffect(() => {
    onBackChannelEnabled?.(backChannelEnabled);
  }, [backChannelEnabled, onBackChannelEnabled]);

  if (state.locked) return <LockedExplainer t={t} />;

  return (
    <View style={[styles.shell, { backgroundColor: t.BG }]}>
      <ChymeJoinBar
        loading={state.loading}
        joinState={call.joinState}
        connection={call.connection}
        onJoin={() => void call.join()}
        onRefresh={() => void state.refresh()}
        refreshing={state.refreshing}
      />
      {state.error ? <ErrorBanner error={state.error} t={t} /> : null}
      {!room && !state.loading ? <JoinRoomPrompt t={t} /> : null}
      {room ? <ChymeRoomView state={state} room={room} user={user} scope={scope} backChannel={backChannelEnabled ? backChannel : null} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The web room fills at least the screen height (minHeight 100dvh) and centers the prompt in what is left.
  shell: { width: '100%', minHeight: Dimensions.get('window').height },
  locked: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  lockedInner: { maxWidth: 420, alignItems: 'center', gap: 14 },
  lockedTitle: { fontSize: 20, textAlign: 'center', fontFamily: interFamily('800') },
  lockedBody: { fontSize: 14, lineHeight: 22.4, textAlign: 'center', fontFamily: interFamily('400') },
  lockedLink: { marginTop: 4, fontSize: 14, fontFamily: interFamily('600') },
  error: { margin: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#2b0b0b', borderWidth: 1, borderColor: '#7f1d1d' },
  errorText: { color: '#fecaca', fontSize: 13, fontFamily: interFamily('400') },
  prompt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  promptIcon: { width: 80, height: 80, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  promptTitle: { fontSize: 24, fontFamily: interFamily('800') },
  promptBody: { fontSize: 15, lineHeight: 24, textAlign: 'center', maxWidth: 400, fontFamily: interFamily('400') },
  promptReadings: { width: '100%', maxWidth: 400 },
});
