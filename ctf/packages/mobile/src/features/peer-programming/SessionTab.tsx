// The Session tab, copied from the web's PeerProgrammingSessionTab (web components/peer-programming/
// pp-session-tab.tsx): the "Live Session" heading with the cohort and its member count, then either
// the join card and the roster, or the live call once joined. Join session asks
// POST /api/peer-programming/session/join for credentials; a failure shows the route's own message.
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Video } from 'lucide-react-native';
import { interFamily } from '../../components/ui';
import { joinSession, type Room, type SessionCredentials } from './PeerProgrammingApi';
import { PeerProgrammingCall } from './PeerProgrammingCall';
import { PPHero } from './PPHero';
import { initials, memberName } from './ppChat';
import { usePPTheme } from './usePPTheme';

function JoinCard({ hasCohort, joining, error, onJoin }: { hasCohort: boolean; joining: boolean; error: string | null; onJoin: () => void }) {
  const t = usePPTheme();
  return (
    <View style={[styles.card, { borderRadius: t.r(16), borderColor: `${t.ACCENT}30`, backgroundColor: t.CARD_BG }]}>
      <Video size={48} color={t.ACCENT} style={styles.icon} />
      <Text style={[styles.cardTitle, { color: t.MUTED }]}>Video session</Text>
      {hasCohort ? null : <Text style={[styles.cardNote, { color: t.FAINT }]}>Join a cohort to access live sessions</Text>}
      {error ? <Text style={[styles.cardNote, styles.cardError]}>{error}</Text> : null}
      {hasCohort ? (
        <TouchableOpacity
          onPress={onJoin}
          disabled={joining}
          accessibilityRole="button"
          style={[styles.join, { borderRadius: t.r(10), backgroundColor: t.ACCENT, opacity: joining ? 0.6 : 1 }]}
        >
          <Text style={styles.joinText}>{joining ? 'Connecting…' : 'Join Session'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// The roster before joining: four tiles a row, each with the member's initials and name.
const GRID_GAP = 10;

function ParticipantGrid({ room }: { room: Room }) {
  const t = usePPTheme();
  const [rowWidth, setRowWidth] = useState(0);
  if (room.members.length === 0) return null;
  const width = (rowWidth - GRID_GAP * 3) / 4;
  return (
    <View style={styles.grid} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
      {rowWidth > 0 && room.members.map((member) => {
        const name = memberName(member);
        return (
          <View key={member.userId} style={[styles.tile, { width, borderRadius: t.r(12), borderColor: `${t.ACCENT}15`, backgroundColor: t.CARD_BG }]}>
            <View style={[styles.avatar, { borderRadius: t.r(20), backgroundColor: `${t.ACCENT}25` }]}>
              <Text style={[styles.avatarText, { color: t.ACCENT }]}>{initials(name)}</Text>
            </View>
            <Text style={[styles.tileName, { color: t.SUBTLE }]}>{name}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function SessionTab({ room }: { room: Room }) {
  const [credentials, setCredentials] = useState<SessionCredentials | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      setCredentials(await joinSession(room.cohort?.id ?? ''));
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Could not start the live session.');
    } finally {
      setJoining(false);
    }
  };

  const count = room.members.length;
  const line = `${room.cohort?.cohortLabel || 'Your Cohort'} · ${count} ${count === 1 ? 'participant' : 'participants'}`;
  return (
    <View style={styles.pad}>
      <PPHero id="ppSessionHero" title="Live Session" line={line} />
      {credentials ? (
        <PeerProgrammingCall credentials={credentials} onLeave={() => setCredentials(null)} />
      ) : (
        <>
          <JoinCard hasCohort={Boolean(room.cohort)} joining={joining} error={error} onJoin={() => void join()} />
          <ParticipantGrid room={room} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 24 },
  card: { paddingVertical: 60, alignItems: 'center', borderWidth: 1, marginBottom: 20 },
  icon: { marginBottom: 12 },
  cardTitle: { fontSize: 16, fontFamily: interFamily('400'), marginBottom: 4 },
  cardNote: { fontSize: 13, fontFamily: interFamily('400'), textAlign: 'center' },
  cardError: { color: '#F87171', marginTop: 8 },
  join: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 32 },
  joinText: { color: '#fff', fontSize: 15, fontFamily: interFamily('700') },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: { padding: 12, borderWidth: 1, alignItems: 'center' },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarText: { fontSize: 14, fontFamily: interFamily('700') },
  tileName: { fontSize: 11, fontFamily: interFamily('400'), textAlign: 'center' },
});
