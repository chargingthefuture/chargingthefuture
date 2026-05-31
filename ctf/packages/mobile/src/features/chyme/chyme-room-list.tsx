/**
 * ChymeRoomList — renders the Chyme room-directory screen.
 * Bound to real data from GET /api/chyme/room:
 *   - roomName, participants, callActive.
 * Omissions from mockup (no backing API field):
 *   - Multiple room cards (API returns one canonical room only).
 *   - Live listener count (not in room response; participants.length used instead).
 *   - Tags/topics per room (no backend field).
 *   - Upcoming/scheduled rooms (no backend endpoint).
 *   - Nations stat (no backend field).
 */
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#22C55E';

export type RoomSummary = {
  roomId: string;
  roomName: string;
  roomKey: string;
  callActive: boolean;
  participantCount: number;
};

type Props = {
  room: RoomSummary;
  tab: 'live' | 'upcoming';
  onTabChange: (tab: 'live' | 'upcoming') => void;
  onJoinRoom: () => void;
  onStartRoom: () => void;
};

export const ChymeRoomList: React.FC<Props> = ({
  room,
  tab,
  onTabChange,
  onJoinRoom,
  onStartRoom,
}) => (
  <View style={styles.container}>
    <View style={styles.statusBar}>
      <Text style={styles.clock}>9:41</Text>
      <Text style={styles.signal}>•••</Text>
    </View>

    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.iconBox}>
          {/* Radio icon — no direct RN lucide; using text glyph */}
          <Text style={styles.iconGlyph}>📻</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Chyme 🎙️</Text>
          <Text style={styles.headerSubtitle}>Social Audio · Encrypted</Text>
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
        <Text style={[styles.tabText, tab === 'live' && styles.tabTextActive]}>
          🔴 Live
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
        onPress={() => onTabChange('upcoming')}
      >
        <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
          📅 Upcoming
        </Text>
      </TouchableOpacity>
    </View>

    {/* Start Room CTA */}
    <View style={styles.ctaWrapper}>
      <TouchableOpacity style={styles.startBtn} onPress={onStartRoom}>
        <Text style={styles.startBtnText}>+ Start a Room</Text>
      </TouchableOpacity>
    </View>

    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
      {tab === 'live' ? (
        <TouchableOpacity style={styles.roomCard} onPress={onJoinRoom}>
          <View style={styles.roomCardHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.roomName}>{room.roomName}</Text>
          </View>
          {/* Host display name not in room response — omitted */}
          <View style={styles.roomMeta}>
            <Text style={styles.roomMetaText}>
              {room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        // Upcoming rooms: no backend endpoint — show informational message only
        <View style={styles.upcomingPlaceholder}>
          <Text style={styles.upcomingText}>
            No upcoming rooms scheduled. Use Start a Room to schedule one.
          </Text>
        </View>
      )}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#021006' },
  statusBar: {
    height: 44,
    backgroundColor: '#030d05',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  clock: { fontSize: 13, fontWeight: '700', color: '#E8EAF0' },
  signal: { fontSize: 12, color: '#9CA3AF' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#052e16',
    backgroundColor: '#030d05',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${PRIMARY}20`,
    borderWidth: 1,
    borderColor: `${PRIMARY}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 18 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F0FDF4' },
  headerSubtitle: { fontSize: 11, color: PRIMARY },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#030d05',
    borderBottomWidth: 1,
    borderBottomColor: '#052e16',
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  statBoxPrimary: {
    backgroundColor: `${PRIMARY}10`,
    borderColor: `${PRIMARY}20`,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: '#E8EAF0' },
  statValuePrimary: { fontSize: 16, fontWeight: '800', color: PRIMARY },
  statLabel: { fontSize: 11, color: '#4B5563', marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#052e16',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: `${PRIMARY}18`,
    borderColor: `${PRIMARY}40`,
  },
  tabText: { fontSize: 13, color: '#6B7280', fontWeight: '400' },
  tabTextActive: { color: PRIMARY, fontWeight: '700' },
  ctaWrapper: { paddingHorizontal: 16, paddingBottom: 10 },
  startBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  roomCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.05)',
    borderWidth: 1,
    borderColor: '#052e16',
    marginBottom: 10,
  },
  roomCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    marginTop: 5,
  },
  roomName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F0FDF4',
    flex: 1,
    lineHeight: 20,
  },
  roomMeta: { flexDirection: 'row', alignItems: 'center' },
  roomMetaText: { fontSize: 12, color: '#16A34A' },
  upcomingPlaceholder: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  upcomingText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
  },
});
