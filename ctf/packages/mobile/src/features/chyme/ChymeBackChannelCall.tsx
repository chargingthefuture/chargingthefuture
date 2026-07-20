/**
 * ChymeBackChannelCall — Screen 5 of the Back Channel handoff (spec #1746). The full-screen active 1:1
 * audio call, shown over the room while a Back Channel is live. It joins its OWN Stream Video call
 * (separate from the room), audio-only, and reuses the app-wide Chyme foreground service (App.tsx), so
 * the call keeps playing when the app is backgrounded. Free — the Foundation note points paid
 * consultations elsewhere. No credits here.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Info, Mic, MicOff, PhoneOff } from 'lucide-react-native';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCall,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import type { JoinCredentials } from './useChymeBackChannel';

const BACK_CHANNEL_CALL_TYPE = 'default';

function initials(name: string): string {
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const ChymeBackChannelCall: React.FC<{
  credentials: JoinCredentials;
  displayName: string;
  otherName: string;
  onHangUp: () => void;
}> = ({ credentials, displayName, otherName, onHangUp }) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('chyme', theme);
  const styles = makeStyles(tokens, accent);
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');

  useEffect(() => {
    let cancelled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: displayName },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(BACK_CHANNEL_CALL_TYPE, credentials.streamCallId);
    void (async () => {
      try {
        await activeCall.join({ create: true });
        try { await activeCall.camera.disable(); } catch { /* no camera */ }
        // A 1:1 call is a conversation — join un-muted (unlike the room, which joins muted).
        try { await activeCall.microphone.enable(); } catch { /* mic unavailable */ }
        if (cancelled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch {
        if (cancelled) return;
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* already left */ }
        try { await videoClient.disconnectUser(); } catch { /* ignore */ }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamToken, credentials.streamUserId, credentials.streamCallId, displayName]);

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onHangUp}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.liveDot} />
          <Text style={styles.headerLabel}>BACK CHANNEL</Text>
        </View>

        {status !== 'joined' || !client || !call ? (
          <View style={styles.center}>
            {status === 'error' ? (
              <Text style={styles.errorText}>Could not connect to the call.</Text>
            ) : (
              <>
                <ActivityIndicator size="large" color={accent} />
                <Text style={styles.connectingText}>Connecting…</Text>
              </>
            )}
            <Pressable style={styles.hangUpFallback} onPress={onHangUp}>
              <PhoneOff size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.hangUpFallbackText}>{status === 'error' ? 'Close' : 'Cancel'}</Text>
            </Pressable>
          </View>
        ) : (
          <StreamVideo client={client}>
            <StreamCall call={call}>
              <BackChannelCallLive otherName={otherName} onHangUp={onHangUp} styles={styles} accent={accent} />
            </StreamCall>
          </StreamVideo>
        )}
      </View>
    </Modal>
  );
};

const BackChannelCallLive: React.FC<{
  otherName: string;
  onHangUp: () => void;
  styles: ReturnType<typeof makeStyles>;
  accent: string;
}> = ({ otherName, onHangUp, styles, accent }) => {
  const { useMicrophoneState, useParticipants } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  const participants = useParticipants();
  const call = useCall();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remoteSpeaking = useMemo(
    () => participants.some((p) => !p.isLocalParticipant && p.isSpeaking),
    [participants],
  );

  return (
    <View style={styles.liveBody}>
      <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>

      <View style={styles.centerStack}>
        <View style={styles.pulseOuter}>
          <View style={styles.pulseMiddle}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials(otherName)}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.otherName} numberOfLines={1}>{otherName}</Text>
        <View style={styles.speakingRow}>
          <Mic size={13} color={remoteSpeaking ? accent : '#6b7280'} strokeWidth={2} />
          <Text style={[styles.speakingText, { color: remoteSpeaking ? accent : '#6b7280' }]}>
            {remoteSpeaking ? 'speaking' : 'listening'}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlItem}>
          <Pressable style={styles.muteCircle} onPress={() => void microphone.toggle()} accessibilityRole="button">
            {isMute ? <MicOff size={24} color={accent} strokeWidth={2} /> : <Mic size={24} color={accent} strokeWidth={2} />}
          </Pressable>
          <Text style={styles.controlLabel}>{isMute ? 'Unmute' : 'Mute'}</Text>
        </View>
        <View style={styles.controlItem}>
          <Pressable
            style={styles.hangUpCircle}
            onPress={() => {
              void (async () => {
                try { await call?.leave(); } catch { /* already left */ }
                onHangUp();
              })();
            }}
            accessibilityRole="button"
          >
            <PhoneOff size={28} color="#fff" strokeWidth={2} />
          </Pressable>
          <Text style={styles.controlLabel}>Hang up</Text>
        </View>
      </View>

      <View style={styles.foundationNote}>
        <Info size={12} color="rgba(134,239,172,0.6)" strokeWidth={2} />
        <Text style={styles.foundationText}>For calls with ServiceCredits attached, use Foundation instead.</Text>
      </View>
    </View>
  );
};

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#061209' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 56, paddingBottom: 8 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent },
    headerLabel: { fontSize: 13, fontWeight: '700', fontFamily: interFamily('700'), color: accent, letterSpacing: 1.5 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    connectingText: { color: t.textMuted, fontSize: 14, fontFamily: interFamily('400') },
    errorText: { color: '#F87171', fontSize: 15, fontFamily: interFamily('400') },
    hangUpFallback: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: '#b91c1c',
    },
    hangUpFallbackText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: interFamily('700') },
    liveBody: { flex: 1, paddingHorizontal: 28, paddingBottom: 40 },
    timer: { textAlign: 'center', color: '#4ade80', fontSize: 15, fontFamily: interFamily('600'), fontWeight: '600', marginBottom: 8 },
    centerStack: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
    pulseOuter: {
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: `${accent}12`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pulseMiddle: {
      width: 108,
      height: 108,
      borderRadius: 54,
      backgroundColor: `${accent}18`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: `${accent}2E`,
      borderWidth: 2.5,
      borderColor: `${accent}80`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: { fontSize: 30, fontWeight: '800', fontFamily: interFamily('800'), color: accent },
    otherName: { fontSize: 22, fontWeight: '700', fontFamily: interFamily('700'), color: '#f0fdf4' },
    speakingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    speakingText: { fontSize: 13, fontFamily: interFamily('400') },
    controls: { flexDirection: 'row', justifyContent: 'center', gap: 48, marginBottom: 24 },
    controlItem: { alignItems: 'center', gap: 8 },
    muteCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: `${accent}1F`,
      borderWidth: 1.5,
      borderColor: `${accent}4D`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hangUpCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#b91c1c',
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlLabel: { fontSize: 11, color: t.textSecondary, fontFamily: interFamily('400') },
    foundationNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: `${accent}0D`,
      borderWidth: 1,
      borderColor: `${accent}26`,
    },
    foundationText: { flex: 1, fontSize: 10, lineHeight: 15, color: 'rgba(134,239,172,0.6)', fontFamily: interFamily('400') },
  });
}
