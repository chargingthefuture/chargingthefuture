/**
 * ChymePublicScreen — the Chyme page for a signed-out visitor, copied from the web (web
 * components/chyme/chyme-public-shell.tsx), in the 3.1 look: Back to Today, the Main Room with who
 * it is open to and its rule, the invitation card with Sign in, what is coming up on TI Radio, then
 * the Live Rooms row with Leave (while listening) and refresh, and the room: listen without an
 * account, or the plain reason when that is not possible. Chyme's parts read the 3.1 colors through
 * ChymeTokensContext.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LogOut, RefreshCw } from 'lucide-react-native';
import { SE_SIGNED_OUT_THEME, HOSTING_NOT_ENDORSEMENT_SHORT, SE_ROOM_MAIN_AUDIENCE, SE_ROOM_RULE, seTheme, type SeThemeTokens } from '@ctf/shared';
import { SE_FONT } from '../se-frame/fonts';
import { interFamily } from '../../components/ui';
import { useAuth } from '../../auth/auth-context';
import { ChymeTokensContext, seChymeTokens, type ChymeTokens } from './chyme-tokens';
import { Spin } from './chyme-join-bar';
import { ChymeUpcoming } from './chyme-upcoming';
import { ChymeReadingsPlayer } from './chyme-readings-player';
import { ChymeGuestListen, GuestNote } from './chyme-guest-listen';
import { getPublicRoom, type LiveState } from './chyme-public-api';

type Listen = { listening: boolean; onListeningChange: (_l: boolean) => void; leaveKey: number };

// The 3.1 header, as the web's signed-out room page has it: Back to Today, the room's name, who it
// is open to and its rule.
function Header({ onBack, se }: { onBack: () => void; se: SeThemeTokens }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} accessibilityRole="link" style={styles.backLink}>
        <Text style={[styles.backText, { color: se.ink }]}>Back to Today</Text>
      </TouchableOpacity>
      <Text style={[styles.eyebrow, { color: se.soft }]}>Chyme · live audio</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: se.ink }]}>
        Main Room
      </Text>
      <Text style={[styles.eyebrow, { color: se.soft }]}>{SE_ROOM_MAIN_AUDIENCE}</Text>
      <Text style={[styles.eyebrow, { color: se.soft }]}>{SE_ROOM_RULE}</Text>
    </View>
  );
}

// Listening needs no account; signing in is for speaking, reacting and hosting.
function Invitation({ onSignIn, se }: { onSignIn: () => void; se: SeThemeTokens }) {
  return (
    <View style={[styles.invite, { borderColor: se.hair, backgroundColor: se.card }]}>
      <Text style={[styles.inviteTitle, { color: se.ink }]}>Live audio rooms for survivors</Text>
      <Text style={[styles.inviteBody, { color: se.soft }]}>Listen in for free. Sign in to speak, react, or host your own room.</Text>
      <Text style={[styles.inviteNote, { color: se.soft }]}>{HOSTING_NOT_ENDORSEMENT_SHORT}</Text>
      <TouchableOpacity
        onPress={onSignIn}
        accessibilityRole="button"
        style={[styles.signIn, { backgroundColor: se.btn, borderColor: se.line, boxShadow: `0px 3px 0px ${se.line}` }]}
      >
        <Text style={[styles.signInText, { color: se.onBtn }]}>Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

function DashedState({ title, body, t, children }: { title: string; body: string; t: ChymeTokens; children?: React.ReactNode }) {
  return (
    <View style={[styles.dashed, { borderRadius: t.radius(10), borderColor: t.BORDER }]}>
      <Text style={[styles.dashedTitle, { color: t.TITLE }]}>{title}</Text>
      <Text style={[styles.dashedBody, { color: t.MUTED }]}>{body}</Text>
      {children}
    </View>
  );
}

function RoomList({ live, onRoomGone, listen, t }: { live: LiveState; onRoomGone: () => void; listen: Listen; t: ChymeTokens }) {
  if (live.checkFailed) return <DashedState title="Couldn't check whether a room is live" body={live.checkFailed} t={t} />;
  if (!live.isLive) {
    return (
      <DashedState title="No public rooms right now" body="Public rooms show up here when hosts go live. The TI Radio guide above says when the next one is." t={t}>
        <ChymeReadingsPlayer onRoomLive={onRoomGone} />
      </DashedState>
    );
  }
  return (
    <View>
      {live.roomName ? <Text style={[styles.roomName, { color: t.TITLE }]}>{live.roomName}</Text> : null}
      {live.guestListenAllowed ? (
        <>
          <Text style={[styles.roomLine, { color: t.MUTED }]}>The room is live. Tap below to listen; sign in to speak.</Text>
          <ChymeGuestListen
            participantCount={live.participantCount}
            guestCount={live.guestCount}
            accent={t.ACCENT}
            onRoomGone={onRoomGone}
            onListeningChange={listen.onListeningChange}
            leaveKey={listen.leaveKey}
          />
        </>
      ) : (
        <>
          <Text style={[styles.roomLine, { color: t.MUTED }]}>The room is live — sign in to join it.</Text>
          <GuestNote accent={t.ACCENT} text="Listening in without an account isn't available right now." detail={live.listenUnavailable ?? 'The server sent no reason.'} />
        </>
      )}
    </View>
  );
}

function RoomsRow({ listening, onLeave, onRefresh, refreshing, t }: { listening: boolean; onLeave: () => void; onRefresh: () => void; refreshing: boolean; t: ChymeTokens }) {
  return (
    <View style={styles.rowHead}>
      <Text style={[styles.rowLabel, { color: t.MUTED }]}>Live Rooms</Text>
      <View style={styles.rowButtons}>
        {listening ? (
          <TouchableOpacity onPress={onLeave} accessibilityRole="button" accessibilityLabel="Leave the room and stop listening" style={[styles.leave, { borderRadius: t.radius(12), backgroundColor: t.INPUT_BG }]}>
            <LogOut size={15} color={t.TITLE} />
            <Text style={[styles.leaveText, { color: t.TITLE }]}>Leave</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onRefresh} disabled={refreshing} accessibilityRole="button" accessibilityLabel="Refresh the room" style={[styles.refresh, { borderRadius: t.radius(12), backgroundColor: t.INPUT_BG }]}>
          <Spin spinning={refreshing}>
            <RefreshCw size={16} color={t.MUTED} />
          </Spin>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function usePublicRoom() {
  const [live, setLive] = useState<LiveState>({ isLive: false, participantCount: 0, guestCount: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const load = useCallback(async () => setLive(await getPublicRoom()), []);
  useEffect(() => {
    void load();
  }, [load]);
  const onRoomGone = useCallback(() => void load(), [load]);
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load();
      setRefreshKey((n) => n + 1);
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshing]);
  return { live, refreshing, refreshKey, onRoomGone, refresh };
}

export function ChymePublicScreen({ onBack }: { onBack: () => void }) {
  const theme = SE_SIGNED_OUT_THEME;
  const se = seTheme(theme.color, theme.mode);
  const t = useMemo(() => seChymeTokens(se), [se]);
  const { signIn } = useAuth();
  const { live, refreshing, refreshKey, onRoomGone, refresh } = usePublicRoom();
  const [listening, setListening] = useState(false);
  const [leaveKey, setLeaveKey] = useState(0);
  const onSignIn = () => void signIn();
  return (
    <ChymeTokensContext.Provider value={t}>
    <View style={[styles.screen, { backgroundColor: se.bg }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Header onBack={onBack} se={se} />
        <Invitation onSignIn={onSignIn} se={se} />
        <View style={styles.body}>
          <View style={[styles.upcoming, { borderRadius: t.radius(10), borderColor: t.BORDER }]}>
            <ChymeUpcoming refreshKey={refreshKey} compact />
          </View>
          <RoomsRow listening={listening} onLeave={() => setLeaveKey((n) => n + 1)} onRefresh={() => void refresh()} refreshing={refreshing} t={t} />
          <RoomList live={live} onRoomGone={onRoomGone} listen={{ listening, onListeningChange: setListening, leaveKey }} t={t} />
        </View>
      </ScrollView>
    </View>
    </ChymeTokensContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: { gap: 2, paddingTop: 20, paddingHorizontal: 16 },
  backLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: 14, textDecorationLine: 'underline', fontFamily: SE_FONT.sans },
  eyebrow: { fontSize: 13, lineHeight: 18, fontFamily: SE_FONT.sans },
  title: { fontSize: 30, lineHeight: 33, fontFamily: SE_FONT.serif },
  invite: { marginTop: 18, marginHorizontal: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 8, borderRadius: 18, borderWidth: 1.5 },
  inviteTitle: { fontSize: 16, fontFamily: SE_FONT.sansBold },
  inviteBody: { fontSize: 15, lineHeight: 21, fontFamily: SE_FONT.sans },
  inviteNote: { fontSize: 13, lineHeight: 19, fontFamily: SE_FONT.sans },
  signIn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 999, borderWidth: 1.5 },
  signInText: { fontSize: 15, fontFamily: SE_FONT.sansBold },
  body: { flex: 1, paddingTop: 18, paddingBottom: 48, paddingHorizontal: 16, gap: 8 },
  upcoming: { borderWidth: 1, overflow: 'hidden' },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', fontFamily: interFamily('700') },
  rowButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leave: { height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  leaveText: { fontSize: 12, fontFamily: interFamily('700') },
  refresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  dashed: { borderWidth: 1, borderStyle: 'dashed', paddingVertical: 20, paddingHorizontal: 14, alignItems: 'stretch' },
  dashedTitle: { fontSize: 13, textAlign: 'center', marginBottom: 4, fontFamily: interFamily('600') },
  dashedBody: { fontSize: 12, lineHeight: 18, textAlign: 'center', fontFamily: interFamily('400') },
  roomName: { fontSize: 13, marginBottom: 2, fontFamily: interFamily('700') },
  roomLine: { fontSize: 12, marginBottom: 8, fontFamily: interFamily('400') },
});
