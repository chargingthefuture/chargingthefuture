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
 *   - Upcoming tab reads the TI Radio guide (GET /api/ti-radio/guide) — the next booked slots,
 *     scheduled rooms MVP (2026-09-19). Room creation and a room per slot are not built.
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
import { formatUpcomingWhen, type ChymeUpcomingSlot } from './api';
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
  // The Upcoming tab's rows: null while the guide is still being read; the error is the route's
  // own reason when the read failed.
  upcoming?: ChymeUpcomingSlot[] | null;
  upcomingError?: string | null;
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
  upcoming = null,
  upcomingError = null,
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
          <UpcomingList upcoming={upcoming} error={upcomingError} styles={styles} accent={accent} />
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

// The Upcoming tab: what is coming up on the TI Radio guide. Four states, each said plainly —
// still reading, the read failed (with the route's reason), nothing booked this week, or the list.
function UpcomingList({ upcoming, error, styles, accent }: { upcoming: ChymeUpcomingSlot[] | null; error: string | null; styles: RoomStyles; accent: string }) {
  if (error) {
    return (
      <View style={styles.upcomingPlaceholder}>
        <Text style={styles.upcomingText}>Couldn&apos;t read the TI Radio guide. {error}</Text>
      </View>
    );
  }
  if (upcoming === null) {
    return (
      <View style={styles.upcomingPlaceholder}>
        <Text style={styles.upcomingText}>Reading the TI Radio guide…</Text>
      </View>
    );
  }
  if (upcoming.length === 0) {
    return (
      <View style={styles.upcomingPlaceholder}>
        <Text style={styles.upcomingText}>
          Nothing is scheduled this week. Any approved member can book a slot on the TI Radio guide on the web and host a discussion here.
        </Text>
      </View>
    );
  }
  const now = new Date();
  return (
    <View>
      <Text style={styles.upcomingHeading}>Coming up on TI Radio</Text>
      {upcoming.map((slot) => (
        <View key={slot.slotStartIso} style={[styles.upcomingCard, slot.isOnAir && { borderColor: accent }]}>
          <Text style={[styles.upcomingWhen, slot.isOnAir && { color: accent }]}>{formatUpcomingWhen(slot.slotStartIso, slot.slotEndIso, now)}</Text>
          {slot.isOnAir ? <Text style={[styles.upcomingOnAir, { color: accent }]}>ON AIR NOW</Text> : null}
          <Text style={styles.upcomingTitle}>{slot.title}</Text>
          <Text style={styles.upcomingHost}>Hosted by @{slot.hostUsername}</Text>
        </View>
      ))}
    </View>
  );
}

// The plain count, with the cap named only once it matters — from 80% of it ("40 of 50
// participants · nearly full") and at it ("· full"). "1 of 50" all day read as a claim that the
// room is capped at 50 or ought to hold 50 (owner report, 2026-09-19). Mirrors the web room's
// chymeParticipantLine.
function participantLine(room: RoomSummary): string {
  const count = room.participantCount;
  const max = room.capacityMax ?? 0;
  if (max > 0 && count >= max) return `${count} of ${max} participants · full`;
  if (max > 0 && count >= Math.ceil(max * 0.8)) return `${count} of ${max} participants · nearly full`;
  return `${count} participant${count !== 1 ? 's' : ''}`;
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
    upcomingHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: t.textMuted, marginBottom: 8, fontFamily: interFamily('700') },
    upcomingCard: { padding: 12, borderRadius: 12, marginBottom: 8, backgroundColor: pick(t.isComic, t.surface, '#041a0b'), borderWidth: 1, borderColor: divider },
    upcomingWhen: { fontSize: 12, fontWeight: '700', color: t.textPrimary, fontFamily: interFamily('700') },
    upcomingOnAir: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginTop: 2, fontFamily: interFamily('700') },
    upcomingTitle: { fontSize: 14, fontWeight: '600', color: t.textPrimary, marginTop: 4, fontFamily: interFamily('600') },
    upcomingHost: { fontSize: 12, color: t.textSecondary, marginTop: 2, fontFamily: interFamily('400') },
    upcomingText: { fontSize: 14, color: t.textSecondary, textAlign: 'center', lineHeight: 22, fontFamily: interFamily('400') },
    disclaimer: { fontSize: 11, color: t.textSecondary, lineHeight: 17, marginTop: 14, fontFamily: interFamily('400') },
    quotaNotice: { marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: 'rgba(234,179,8,0.12)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.35)' },
    quotaNoticeRed: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)' },
    quotaNoticeText: { fontSize: 13, lineHeight: 19, color: '#FDE68A', fontFamily: interFamily('400') },
    quotaNoticeTextRed: { color: '#FCA5A5' },
  });
}
