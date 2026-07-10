/**
 * PeerProgrammingSessionCall — the live video call for a PeerProgramming cohort on
 * Android (React Native). It mirrors the working web call
 * (ctf/packages/web/components/peer-programming/pp-session-call.tsx) and reuses the
 * Chyme audio-room lifecycle pattern (ChymeAudioRoom.tsx): join the cohort's Stream
 * video call, render one video tile per participant, let the member mute/unmute and
 * stop/start their camera, and leave + tear down the call on unmount or when the
 * member leaves.
 *
 * The video is carried by the Stream Video React Native SDK over WebRTC, which needs
 * native code — this works only in an EAS dev/production build, never in Expo Go.
 *
 * Real data only: the api key, call id, user id, and token all come from the real
 * POST /api/peer-programming/session/join response. One call per cohort: the call id
 * is derived server-side from the cohort id, so every cohort member joins the same
 * call and members of other cohorts cannot.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantView,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-native-sdk';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import type { PeerProgrammingSessionCredentials } from './api';

// Same call type as the web call and the Chyme room: the plain "default" type where
// members may publish audio and video. Matches pp-session-call.tsx exactly.
const CALL_TYPE = 'default';

type Props = {
  credentials: PeerProgrammingSessionCredentials;
  displayName: string;
  onLeave: () => void;
};

export const PeerProgrammingSessionCall: React.FC<Props> = ({ credentials, displayName, onLeave }) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: displayName },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, credentials.streamCallId);

    void (async () => {
      try {
        await activeCall.join({ create: true });
        // Camera and microphone start enabled so joining puts the member on screen;
        // they can mute/stop from the controls. Matches the web call.
        try {
          await activeCall.camera.enable();
        } catch {
          /* no camera available */
        }
        try {
          await activeCall.microphone.enable();
        } catch {
          /* no mic available */
        }
        if (cancelled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (error) {
        if (cancelled) return;
        // Surface the real Stream error verbatim so a failed join is diagnosable
        // without a repro.
        setErrorMessage(error instanceof Error ? error.message : 'Could not connect to the live session.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          await activeCall.leave();
        } catch {
          /* already left */
        }
        try {
          await videoClient.disconnectUser();
        } catch {
          /* ignore */
        }
      })();
    };
  }, [
    credentials.streamApiKey,
    credentials.streamToken,
    credentials.streamUserId,
    credentials.streamCallId,
    displayName,
  ]);

  if (status !== 'joined' || !client || !call) {
    return (
      <View style={styles.center}>
        {status === 'error' ? (
          <>
            <Text style={styles.errorText}>{errorMessage ?? 'Could not connect to the live session.'}</Text>
            <TouchableOpacity style={styles.backBtn} onPress={onLeave} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={accent} />
            <Text style={styles.connectingText}>Connecting to the live session…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <PeerProgrammingSessionStage onLeave={onLeave} />
      </StreamCall>
    </StreamVideo>
  );
};

const PeerProgrammingSessionStage: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('peer-programming', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const { useParticipants, useCameraState, useMicrophoneState } = useCallStateHooks();
  const participants = useParticipants();
  const { camera, isMute: cameraOff } = useCameraState();
  const { microphone, isMute: micOff } = useMicrophoneState();

  // One tile per user — a lingering extra session would otherwise double a member up.
  // Matches the web call's de-duplication.
  const uniqueParticipants = useMemo(() => {
    const byUser = new Map<string, StreamVideoParticipant>();
    for (const participant of participants) {
      const existing = byUser.get(participant.userId);
      if (!existing || (participant.isLocalParticipant && !existing.isLocalParticipant)) {
        byUser.set(participant.userId, participant);
      }
    }
    return Array.from(byUser.values());
  }, [participants]);

  return (
    <View style={styles.stage}>
      <Text style={styles.liveLabel}>
        Live · {uniqueParticipants.length} {uniqueParticipants.length === 1 ? 'participant' : 'participants'}
      </Text>
      {uniqueParticipants.length === 0 ? (
        <Text style={styles.emptyText}>Waiting for participants…</Text>
      ) : (
        <View style={styles.grid}>
          {uniqueParticipants.map((participant) => (
            <View key={participant.sessionId} style={styles.tile}>
              <ParticipantView participant={participant} />
            </View>
          ))}
        </View>
      )}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, micOff ? styles.controlBtnOff : styles.controlBtnOn]}
          onPress={() => void microphone.toggle()}
          accessibilityRole="button"
          accessibilityLabel={micOff ? 'Unmute' : 'Mute'}
        >
          <Text style={styles.controlIcon}>{micOff ? '🔇' : '🎤'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, cameraOff ? styles.controlBtnOff : styles.controlBtnOn]}
          onPress={() => void camera.toggle()}
          accessibilityRole="button"
          accessibilityLabel={cameraOff ? 'Start camera' : 'Stop camera'}
        >
          <Text style={styles.controlIcon}>{cameraOff ? '📷' : '🎥'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, styles.leaveControlBtn]}
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel="Leave session"
        >
          <Text style={styles.controlIcon}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  connectingText: { color: '#9CA3AF', fontSize: 14, marginTop: 16 },
  errorText: { color: '#F87171', fontSize: 14, textAlign: 'center', marginBottom: 18, lineHeight: 22 },
  backBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  backBtnText: { color: '#F87171', fontSize: 14, fontWeight: '700' },
  stage: { paddingHorizontal: 16, paddingVertical: 16 },
  liveLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: t.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  emptyText: { color: t.textSecondary, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${accent}25`,
    backgroundColor: '#000',
  },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 22 },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  controlBtnOn: { backgroundColor: `${accent}20`, borderColor: `${accent}40` },
  controlBtnOff: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
  leaveControlBtn: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.35)' },
  controlIcon: { fontSize: 20 },
  });
}
