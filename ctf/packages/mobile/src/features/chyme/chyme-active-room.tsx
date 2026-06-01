/**
 * ChymeActiveRoom — renders the in-room stage view.
 * Bound to real data from GET /api/chyme/room:
 *   - roomName, roomKey, callActive, participants[].displayName, participants[].role.
 * Omissions from mockup (no backing API field):
 *   - Per-speaker "speaking" / audio-activity indicator (no WebRTC event bus in mobile).
 *   - Per-speaker muted state (no backend field).
 *   - Audience initials list beyond participants (only real participants shown).
 *   - Listener count badge (uses participants.length).
 */
import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#22C55E';

type Participant = {
  userId: string;
  displayName: string;
  role: 'speaker' | 'listener';
};

type Props = {
  roomName: string;
  participants: Participant[];
  muted: boolean;
  handRaised: boolean;
  onToggleMute: () => void;
  onToggleHand: () => void;
  onOpenChat: () => void;
  onLeave: () => void;
};

function initials(name: string): string {
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function AudienceBubble({ participant }: { participant: Participant }) {
  return (
    <View style={speakerStyles.audienceBubble}>
      <Text style={speakerStyles.audienceInitials}>{initials(participant.displayName)}</Text>
    </View>
  );
}

function SpeakerBubble({ participant }: { participant: Participant }) {
  const init = initials(participant.displayName);
  return (
    <View style={speakerStyles.wrapper}>
      <View style={speakerStyles.avatar}>
        <Text style={speakerStyles.initials}>{init}</Text>
      </View>
      <Text style={speakerStyles.name} numberOfLines={1}>
        {participant.displayName}
      </Text>
      <View style={speakerStyles.roleBadge}>
        <Text style={speakerStyles.roleText}>
          {participant.role === 'speaker' ? 'Speaker' : 'Host'}
        </Text>
      </View>
    </View>
  );
}

export const ChymeActiveRoom: React.FC<Props> = ({
  roomName,
  participants,
  muted,
  handRaised,
  onToggleMute,
  onToggleHand,
  onOpenChat,
  onLeave,
}) => {
  const speakers = participants.filter((p) => p.role === 'speaker');
  const listeners = participants.filter((p) => p.role === 'listener');

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.clock}>9:41</Text>
        <Text style={styles.signal}>•••</Text>
      </View>

      {/* Room header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
          <Text style={styles.safeLabel}>Safe Space 🔒</Text>
          <TouchableOpacity style={styles.chatBtn} onPress={onOpenChat}>
            <Text style={styles.chatBtnIcon}>💬</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.roomName}>{roomName}</Text>
        <Text style={styles.listenerCount}>
          {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Stage */}
      <FlatList
        data={speakers.length > 0 ? speakers : participants}
        keyExtractor={(item) => item.userId}
        numColumns={3}
        contentContainerStyle={styles.stage}
        ListHeaderComponent={
          <Text style={styles.sectionLabel}>
            On Stage · {speakers.length > 0 ? speakers.length : participants.length}
          </Text>
        }
        renderItem={({ item }) => <SpeakerBubble participant={item} />}
        ListFooterComponent={
          listeners.length > 0 ? (
            <View style={styles.audienceSection}>
              <Text style={styles.sectionLabel}>
                Audience · {listeners.length}
              </Text>
              <View style={styles.audienceRow}>
                {listeners.slice(0, 7).map((p) => (
                  <React.Fragment key={p.userId}>
                    <AudienceBubble participant={p} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          ) : null
        }
      />

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={onToggleMute}>
            <View
              style={[
                styles.controlCircle,
                muted ? styles.controlCircleMuted : styles.controlCircleActive,
              ]}
            >
              <Text style={styles.controlIcon}>{muted ? '🔇' : '🎤'}</Text>
            </View>
            <Text style={[styles.controlLabel, muted && styles.controlLabelMuted]}>
              {muted ? 'Unmute' : 'Muted'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={onToggleHand}>
            <View
              style={[
                styles.controlCircle,
                handRaised ? styles.controlCircleHand : styles.controlCircleNeutral,
              ]}
            >
              <Text style={styles.controlIcon}>✋</Text>
            </View>
            <Text style={[styles.controlLabel, handRaised && styles.controlLabelHand]}>
              Hand
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={onOpenChat}>
            <View style={[styles.controlCircle, styles.controlCircleNeutral]}>
              <Text style={styles.controlIcon}>💬</Text>
            </View>
            <Text style={styles.controlLabel}>Chat</Text>
          </TouchableOpacity>

          {/* React/heart: no backend endpoint — visual only, omitted as interactive action */}
          <View style={styles.controlBtn}>
            <View style={[styles.controlCircle, styles.controlCircleNeutral]}>
              <Text style={styles.controlIcon}>🤍</Text>
            </View>
            <Text style={styles.controlLabel}>React</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.leaveBtn} onPress={onLeave}>
          <Text style={styles.leaveBtnText}>📞 Leave Room</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const speakerStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 80,
    marginBottom: 20,
    marginHorizontal: 10,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 3,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  initials: { fontSize: 18, fontWeight: '800', color: PRIMARY },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E8EAF0',
    textAlign: 'center',
  },
  roleBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 20,
    backgroundColor: `${PRIMARY}18`,
    borderWidth: 1,
    borderColor: `${PRIMARY}30`,
  },
  roleText: { fontSize: 10, color: PRIMARY },
  audienceBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceInitials: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
});

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
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#052e16',
    backgroundColor: '#030d05',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 1,
    borderColor: `${PRIMARY}30`,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: PRIMARY,
  },
  liveText: { fontSize: 10, color: PRIMARY, fontWeight: '700' },
  safeLabel: { fontSize: 11, color: '#4B5563', flex: 1 },
  chatBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtnIcon: { fontSize: 15 },
  roomName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F0FDF4',
    lineHeight: 22,
    marginBottom: 4,
  },
  listenerCount: { fontSize: 12, color: '#16A34A' },
  stage: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#4B5563',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  audienceSection: { marginTop: 8 },
  audienceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  controls: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#052e16',
    backgroundColor: '#030d05',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  controlBtn: { alignItems: 'center', gap: 4 },
  controlCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  controlCircleActive: {
    backgroundColor: `${PRIMARY}18`,
    borderColor: `${PRIMARY}50`,
  },
  controlCircleMuted: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.5)',
  },
  controlCircleHand: {
    backgroundColor: 'rgba(234,179,8,0.15)',
    borderColor: 'rgba(234,179,8,0.5)',
  },
  controlCircleNeutral: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  controlIcon: { fontSize: 20 },
  controlLabel: { fontSize: 11, color: '#6B7280' },
  controlLabelMuted: { color: '#F87171' },
  controlLabelHand: { color: '#FDE047' },
  leaveBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: { color: '#F87171', fontSize: 15, fontWeight: '700' },
});
