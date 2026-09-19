/**
 * ChymeRoomList — renders the Chyme room-directory screen.
 * Bound to real data from GET /api/chyme/room:
 *   - roomName, participants, callActive.
 * Theme: colors come from the active theme tokens (passed in from ChymeRoom). Default
 * theme keeps the deep-green Chyme chrome; comic theme uses the ink/cream palette with
 * sharp corners per ComicChyme.tsx.
 * Omissions from mockup (no backing API field):
 *   - Multiple room cards (API returns one canonical room only).
 *   - Live listener count (not in room response; participants.length used instead).
 *   - Tags/topics per room (no backend field).
 *   - Upcoming/scheduled rooms (no backend endpoint).
 *   - Nations stat (no backend field).
 */
import React, { useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Radio } from 'lucide-react-native';
import { HOSTING_NOT_ENDORSEMENT_SHORT } from '@ctf/shared';
import { type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';

export type RoomSummary = {
  roomId: string;
  roomName: string;
  roomKey: string;
  callActive: boolean;
  participantCount: number;
  // The cap in force, for "N of M"; the quota notice is the member-facing line the server sends
  // while the Stream Video month is getting tight (null when there is nothing to say).
  capacityMax?: number;
  quotaNotice?: string | null;
  quotaBand?: 'green' | 'yellow' | 'orange' | 'red';
};

type Props = {
  room: RoomSummary;
  tab: 'live' | 'upcoming';
  onTabChange: (_tab: 'live' | 'upcoming') => void;
  onJoinRoom: () => void;
  onStartRoom: () => void;
  tokens: ThemeTokens;
  accent: string;
  refreshing: boolean;
  onRefresh: () => void;
};

export const ChymeRoomList: React.FC<Props> = ({
  room,
  tab,
  onTabChange,
  onJoinRoom,
  onStartRoom,
  tokens,
  accent,
  refreshing,
  onRefresh,
}) => {
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.clock}>9:41</Text>
        <Text style={styles.signal}>•••</Text>
      </View>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Radio size={20} color={accent} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Chyme 🎙️</Text>
            <Text style={styles.headerSubtitle}>Social Audio</Text>
          </View>
        </View>
      </View>

      {/* Stats — listeners omitted (no direct API field); participants used */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, styles.statBoxPrimary]}>
          <Text style={styles.statValuePrimary}>1</Text>
          <Text style={styles.statLabel}>Live Rooms</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{room.participantCount}</Text>
          <Text style={styles.statLabel}>Participants</Text>
        </View>
        {/* Nations omitted — no backing API field */}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'live' && styles.tabActive]}
          onPress={() => onTabChange('live')}
        >
          <Text style={[styles.tabText, tab === 'live' && styles.tabTextActive]}>🔴 Live</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
          onPress={() => onTabChange('upcoming')}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>📅 Upcoming</Text>
        </TouchableOpacity>
      </View>

      {/* Start Room CTA */}
      <View style={styles.ctaWrapper}>
        <TouchableOpacity style={styles.startBtn} onPress={onStartRoom}>
          <Text style={styles.startBtnText}>+ Start a Room</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {tab === 'live' ? (
          <LiveRoomCard room={room} onJoinRoom={onJoinRoom} styles={styles} />
        ) : (
          // Upcoming rooms: no backend endpoint — show informational message only
          <View style={styles.upcomingPlaceholder}>
            <Text style={styles.upcomingText}>
              No upcoming rooms scheduled. Use Start a Room to schedule one.
            </Text>
          </View>
        )}
        {/* Same statement as both web surfaces, from the one string in @ctf/shared rather than a
            copy typed in here — a second wording would be free to drift, and this is exactly the
            promise that must not say different things in different places. Under the list so it
            reads as a note about what the list is, not as a warning about the room above it. */}
        <Text style={styles.disclaimer}>{HOSTING_NOT_ENDORSEMENT_SHORT}</Text>
      </ScrollView>
    </View>
  );
};

type RoomStyles = ReturnType<typeof makeStyles>;

// "N participants" or, when the server sent the cap in force, "N of M participants".
function participantLine(room: RoomSummary): string {
  if (room.capacityMax) {
    return `${room.participantCount} of ${room.capacityMax} participants`;
  }
  return `${room.participantCount} participant${room.participantCount !== 1 ? 's' : ''}`;
}

// The one live room's card, plus the same quota line the web room shows under its header — only
// while the server has something to say (Yellow band and above). Red reads in the warning color.
function LiveRoomCard({ room, onJoinRoom, styles }: { room: RoomSummary; onJoinRoom: () => void; styles: RoomStyles }) {
  const red = room.quotaBand === 'red';
  return (
    <>
      <TouchableOpacity style={styles.roomCard} onPress={onJoinRoom}>
        <View style={styles.roomCardHeader}>
          <View style={styles.liveDot} />
          <Text style={styles.roomName}>{room.roomName}</Text>
        </View>
        {/* Host display name not in room response — omitted */}
        <View style={styles.roomMeta}>
          <Text style={styles.roomMetaText}>{participantLine(room)}</Text>
        </View>
      </TouchableOpacity>
      {room.quotaNotice ? (
        <View style={[styles.quotaNotice, red && styles.quotaNoticeRed]}>
          <Text style={[styles.quotaNoticeText, red && styles.quotaNoticeTextRed]}>{room.quotaNotice}</Text>
        </View>
      ) : null}
    </>
  );
}

// Pick one of two values by the comic-theme flag. Both branches are side-effect-free
// literals/token reads, so eager evaluation matches the original inline ternaries exactly.
// Routing every `t.isComic ? …` through this keeps makeStyles' cyclomatic complexity flat.
const pick = <T,>(isComic: boolean, comic: T, plain: T): T => (isComic ? comic : plain);

function makeStyles(t: ThemeTokens, accent: string) {
  const bg = pick(t.isComic, t.bg, '#04160A');
  const chrome = pick(t.isComic, t.surfaceAlt, '#030d05');
  const divider = pick(t.isComic, t.border, '#052e16');
  const r = t.radius;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    statusBar: {
      height: 44,
      backgroundColor: chrome,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    clock: { fontSize: 13, fontWeight: '700', fontFamily: interFamily('700'), color: pick(t.isComic, t.border, t.textShell) },
    signal: { fontSize: 12, color: t.textSecondary, fontFamily: interFamily('400') },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: pick(t.isComic, 2, 1),
      borderBottomColor: divider,
      backgroundColor: chrome,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBox: {
      width: 38,
      height: 38,
      borderRadius: pick(t.isComic, 0, 12),
      backgroundColor: pick(t.isComic, t.surface, `${accent}20`),
      borderWidth: pick(t.isComic, 2, 1),
      borderColor: pick(t.isComic, t.border, `${accent}40`),
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlyph: { fontSize: 18, fontFamily: interFamily('400') },
    headerTitle: { fontSize: 18, fontWeight: '800', fontFamily: interFamily('800'), color: pick(t.isComic, t.textPrimary, '#F0FDF4'), letterSpacing: pick(t.isComic, 0.6, 0), textTransform: pick(t.isComic, 'uppercase', 'none') },
    headerSubtitle: { fontSize: 11, color: pick(t.isComic, t.textSecondary, accent), fontFamily: interFamily('400') },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: chrome,
      borderBottomWidth: pick(t.isComic, 2, 1),
      borderBottomColor: divider,
    },
    statBox: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: r,
      backgroundColor: pick(t.isComic, t.surface, 'rgba(255,255,255,0.03)'),
      borderWidth: pick(t.isComic, 1.5, 1),
      borderColor: pick(t.isComic, `${t.border}35`, 'rgba(255,255,255,0.07)'),
      alignItems: 'center',
    },
    statBoxPrimary: {
      backgroundColor: pick(t.isComic, `${t.border}10`, `${accent}10`),
      borderColor: pick(t.isComic, t.border, `${accent}20`),
    },
    statValue: { fontSize: 16, fontWeight: '800', fontFamily: interFamily('800'), color: pick(t.isComic, t.textPrimary, t.textShell) },
    statValuePrimary: { fontSize: 16, fontWeight: '800', fontFamily: interFamily('800'), color: pick(t.isComic, t.border, accent) },
    statLabel: { fontSize: 11, color: t.textSecondary, marginTop: 2, fontFamily: interFamily('400') },
    tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    tab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: r,
      borderWidth: pick(t.isComic, 2, 1),
      borderColor: pick(t.isComic, `${t.borderDim}40`, '#052e16'),
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: pick(t.isComic, `${t.border}14`, `${accent}18`),
      borderColor: pick(t.isComic, t.border, `${accent}40`),
    },
    tabText: { fontSize: 13, color: t.textSecondary, fontWeight: '400', fontFamily: interFamily('400'), textTransform: pick(t.isComic, 'uppercase', 'none'), letterSpacing: pick(t.isComic, 0.6, 0) },
    tabTextActive: { color: pick(t.isComic, t.textPrimary, accent), fontWeight: '700' },
    ctaWrapper: { paddingHorizontal: 16, paddingBottom: 10 },
    startBtn: {
      width: '100%',
      paddingVertical: 12,
      borderRadius: r,
      backgroundColor: pick(t.isComic, t.surface, accent),
      borderWidth: pick(t.isComic, 1.5, 0),
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startBtnText: { color: pick(t.isComic, t.border, '#fff'), fontSize: 14, fontWeight: pick(t.isComic, '800', '700'), fontFamily: interFamily(pick(t.isComic, '800', '700')), textTransform: pick(t.isComic, 'uppercase', 'none'), letterSpacing: pick(t.isComic, 0.6, 0) },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 16 },
    roomCard: {
      padding: 16,
      borderRadius: r,
      backgroundColor: pick(t.isComic, t.surface, 'rgba(34,197,94,0.05)'),
      borderWidth: pick(t.isComic, 1.5, 1),
      borderColor: pick(t.isComic, `${t.border}35`, '#052e16'),
      marginBottom: 10,
    },
    roomCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
    liveDot: { width: 8, height: 8, borderRadius: pick(t.isComic, 0, 4), backgroundColor: t.success, marginTop: 5 },
    roomName: { fontSize: 14, fontWeight: '600', fontFamily: interFamily('600'), color: pick(t.isComic, t.textPrimary, '#F0FDF4'), flex: 1, lineHeight: 20 },
    roomMeta: { flexDirection: 'row', alignItems: 'center' },
    roomMetaText: { fontSize: 12, color: pick(t.isComic, t.textSecondary, '#16A34A'), fontFamily: interFamily('400') },
    upcomingPlaceholder: { paddingVertical: 24, alignItems: 'center' },
    upcomingText: { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 22, fontFamily: interFamily('400') },
    disclaimer: { fontSize: 11, color: t.textSecondary, lineHeight: 17, marginTop: 14, fontFamily: interFamily('400') },
    quotaNotice: { marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: 'rgba(234,179,8,0.12)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.35)' },
    quotaNoticeRed: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)' },
    quotaNoticeText: { fontSize: 13, lineHeight: 19, color: '#FDE68A', fontFamily: interFamily('400') },
    quotaNoticeTextRed: { color: '#FCA5A5' },
  });
}
