/**
 * ChymePublicScreen — the Chyme page for a signed-out visitor, copied from the web (web
 * components/chyme/chyme-public-shell.tsx): its own green header with the back control, the
 * invitation card with Sign In, what is coming up on TI Radio, then the Live Rooms row with Leave
 * (while listening) and refresh, and the room: listen without an account, read the room chat, or
 * the plain reason when that is not possible.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, LogIn, LogOut, Radio, RefreshCw } from 'lucide-react-native';
import { HOSTING_NOT_ENDORSEMENT_SHORT } from '@ctf/shared';
import { interFamily } from '../../components/ui';
import { useAuth } from '../../auth/auth-context';
import { useChymeTokens, type ChymeTokens } from './chyme-tokens';
import { GradientFill, Spin } from './chyme-join-bar';
import { ChymeUpcoming } from './chyme-upcoming';
import { ChymeReadingsPlayer } from './chyme-readings-player';
import { ChymeGuestListen, GuestNote } from './chyme-guest-listen';
import { ChymeGuestChat } from './chyme-guest-chat';
import { getPublicRoom, type LiveState } from './chyme-public-api';

type Listen = { listening: boolean; onListeningChange: (_l: boolean) => void; leaveKey: number };

function Header({ onBack, t }: { onBack: () => void; t: ChymeTokens }) {
  return (
    <View style={styles.header}>
      <GradientFill from={t.ACCENT} to="#16A34A" id="chyme-public-header" horizontal />
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to apps" style={[styles.back, { borderRadius: t.radius(8) }]}>
        <ChevronLeft size={18} color={t.TEXT} />
      </TouchableOpacity>
      <Radio size={16} color="#fff" />
      <View style={styles.flex}>
        <Text style={styles.headerTitle}>Chyme</Text>
        <Text style={styles.headerSub}>Live audio for survivors</Text>
      </View>
    </View>
  );
}

function Invitation({ onSignIn, t }: { onSignIn: () => void; t: ChymeTokens }) {
  return (
    <View style={[styles.invite, { borderRadius: t.radius(14), borderColor: `${t.ACCENT}30`, backgroundColor: `${t.ACCENT}06` }]}>
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { borderRadius: t.radius(20), backgroundColor: `${t.ACCENT}15`, borderColor: `${t.ACCENT}30` }]}>
          <View style={[styles.badgeDot, { borderRadius: t.radius(2.5), backgroundColor: t.ACCENT }]} />
          <Text style={[styles.badgeText, { color: t.ACCENT }]}>LIVE AUDIO</Text>
        </View>
      </View>
      <Text style={[styles.inviteTitle, { color: t.TITLE }]}>Live audio rooms for survivors</Text>
      <Text style={[styles.inviteBody, { color: t.MUTED }]}>Listen in for free. Sign in to speak, react, or host your own room.</Text>
      <Text style={[styles.inviteNote, { color: t.MUTED }]}>{HOSTING_NOT_ENDORSEMENT_SHORT}</Text>
      <TouchableOpacity onPress={onSignIn} accessibilityRole="button" style={[styles.signIn, { borderRadius: t.radius(9), backgroundColor: t.ACCENT }]}>
        <LogIn size={13} color="#fff" />
        <Text style={styles.signInText}>Sign In</Text>
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

function RoomList({ live, onRoomGone, onSignIn, refreshKey, listen, t }: { live: LiveState; onRoomGone: () => void; onSignIn: () => void; refreshKey: number; listen: Listen; t: ChymeTokens }) {
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
          <View style={styles.chatGap}>
            <ChymeGuestChat onSignIn={onSignIn} refreshKey={refreshKey} />
          </View>
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
        <TouchableOpacity onPress={onRefresh} disabled={refreshing} accessibilityRole="button" accessibilityLabel="Refresh the room and chat" style={[styles.refresh, { borderRadius: t.radius(12), backgroundColor: t.INPUT_BG }]}>
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
  const t = useChymeTokens();
  const { signIn } = useAuth();
  const { live, refreshing, refreshKey, onRoomGone, refresh } = usePublicRoom();
  const [listening, setListening] = useState(false);
  const [leaveKey, setLeaveKey] = useState(0);
  const onSignIn = () => void signIn();
  return (
    <View style={[styles.screen, { backgroundColor: t.BG }]}>
      <Header onBack={onBack} t={t} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Invitation onSignIn={onSignIn} t={t} />
        <View style={styles.body}>
          <View style={[styles.upcoming, { borderRadius: t.radius(10), borderColor: t.BORDER }]}>
            <ChymeUpcoming refreshKey={refreshKey} compact />
          </View>
          <RoomsRow listening={listening} onLeave={() => setLeaveKey((n) => n + 1)} onRefresh={() => void refresh()} refreshing={refreshing} t={t} />
          <RoomList live={live} onRoomGone={onRoomGone} onSignIn={onSignIn} refreshKey={refreshKey} listen={{ listening, onListeningChange: setListening, leaveKey }} t={t} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Takes back the app's content padding: the web page runs edge to edge.
  screen: { flex: 1, marginHorizontal: -12, marginTop: -10 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, overflow: 'hidden' },
  back: {
    width: 32,
    height: 32,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerTitle: { fontSize: 14, color: '#fff', fontFamily: interFamily('700') },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: interFamily('400') },
  invite: { marginTop: 10, marginHorizontal: 12, padding: 14, borderWidth: 1 },
  badgeRow: { flexDirection: 'row', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1 },
  badgeDot: { width: 5, height: 5 },
  badgeText: { fontSize: 10, fontFamily: interFamily('700') },
  inviteTitle: { fontSize: 14, lineHeight: 19.6, marginBottom: 6, fontFamily: interFamily('700') },
  inviteBody: { fontSize: 12, lineHeight: 18, marginBottom: 12, fontFamily: interFamily('400') },
  inviteNote: { fontSize: 11, lineHeight: 16.5, marginBottom: 12, fontFamily: interFamily('400') },
  signIn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 9 },
  signInText: { color: '#fff', fontSize: 12, fontFamily: interFamily('700') },
  body: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
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
  chatGap: { marginTop: 10 },
});
