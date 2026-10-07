// The Session tab: the cohort's live video call. Before joining it shows the cohort and a Join
// session button; the button asks POST /api/peer-programming/session/join for credentials and, on
// success, mounts the call. A 404 (no cohort) or 503 (live video not configured) shows the route's
// own message. A member listening in on a cohort they were not placed in can read it but cannot join
// its call, the same as the web.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { joinSession, type Room, type SessionCredentials } from './PeerProgrammingApi';
import { PeerProgrammingCall } from './PeerProgrammingCall';
import { PPButton } from './PPButton';
import { usePPTheme } from './usePPTheme';

// Why the viewer cannot join, or null when they can.
function joinBlocked(room: Room): string | null {
  if (!room.cohort) return 'Join a cohort to access live sessions';
  if (room.access !== 'member') return 'You’re listening in — only cohort members can join the call.';
  return null;
}

function JoinCard({ room, joining, error, onJoin }: { room: Room; joining: boolean; error: string | null; onJoin: () => void }) {
  const { tokens } = usePPTheme();
  const blocked = joinBlocked(room);
  return (
    <View style={[styles.card, { borderColor: tokens.border, borderRadius: tokens.radius }]}>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>Video session</Text>
      {blocked ? <Text style={[styles.text, { color: tokens.textMuted }]}>{blocked}</Text> : null}
      {error ? <Text style={[styles.text, { color: tokens.danger }]}>{error}</Text> : null}
      {blocked ? null : <PPButton label={joining ? 'Connecting…' : 'Join session'} primary disabled={joining} onPress={onJoin} />}
      {blocked ? null : (
        <Text style={[styles.text, { color: tokens.textMuted }]}>
          Your camera and microphone turn on when you join. The call keeps going if you switch to another app.
        </Text>
      )}
    </View>
  );
}

export function SessionTab({ room }: { room: Room }) {
  const { tokens } = usePPTheme();
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

  const cohortLine = room.cohort ? `${room.cohort.cohortLabel} · ${room.cohort.memberCount} members` : 'Your cohort';
  return (
    <View style={styles.stack}>
      <View>
        <Text style={[styles.heading, { color: tokens.textPrimary }]}>Live Session</Text>
        <Text style={[styles.text, { color: tokens.textSecondary }]}>{cohortLine}</Text>
      </View>
      {credentials ? (
        <PeerProgrammingCall credentials={credentials} onLeave={() => setCredentials(null)} />
      ) : (
        <JoinCard room={room} joining={joining} error={error} onJoin={() => void join()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  heading: { fontSize: 20, fontWeight: '800' },
  card: { borderWidth: 1, padding: 24, alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '600' },
  text: { fontSize: 13, textAlign: 'center' },
});
