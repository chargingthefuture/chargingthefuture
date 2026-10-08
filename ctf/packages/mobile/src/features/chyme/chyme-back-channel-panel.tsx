/**
 * The live Back Channel call, copied from the web (web components/chyme/chyme-back-channel-panel.tsx):
 * a small card at the bottom left of the screen while a 1:1 call is live, so the room stays usable
 * behind it. It joins its OWN Stream Video call (separate from the room), audio-only, and the
 * app-wide foreground service (App.tsx) keeps it playing when the app is in the background. Free —
 * the Foundation note points calls with ServiceCredits attached elsewhere.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Info, Mic, MicOff, PhoneOff } from 'lucide-react-native';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCall,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { interFamily } from '../../components/ui';
import type { JoinCredentials } from './useChymeBackChannel';
import { reportError } from '../../observability/report';
import { initials, useChymeTokens, type ChymeTokens } from './chyme-tokens';
import { PulseDot } from './chyme-pulse-dot';

const BACK_CHANNEL_CALL_TYPE = 'default';
const PRIMARY = '#22C55E';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type JoinStatus = 'connecting' | 'joined' | 'error';

// Join the 1:1 call un-muted (a conversation, unlike the room), then turn the camera off. The join
// steps are unchanged from the earlier full-screen call.
function useBackChannelJoin(credentials: JoinCredentials, displayName: string) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<JoinStatus>('connecting');
  // Stream's own reason for a failed join, shown under the status line.
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: displayName },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(BACK_CHANNEL_CALL_TYPE, credentials.streamCallId);
    void (async () => {
      try {
        await activeCall.join({ create: true });
        try { await activeCall.camera.disable(); } catch { /* no-trace: there is no camera on this device */ }
        try { await activeCall.microphone.enable(); } catch { /* no-trace: the microphone is unavailable on this device */ }
        if (canceled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (caught) {
        reportError(caught, { area: 'chyme', op: 'back_channel_join', extra: { callId: credentials.streamCallId } });
        if (canceled) return;
        setErrorDetail(caught instanceof Error ? caught.message : String(caught));
        setStatus('error');
      }
    })();
    return () => {
      canceled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* no-trace: the call was already left */ }
        try { await videoClient.disconnectUser(); } catch { /* no-trace: the client is already disconnected */ }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamToken, credentials.streamUserId, credentials.streamCallId, displayName]);

  return { client, call, status, errorDetail };
}

export const ChymeBackChannelPanel: React.FC<{
  credentials: JoinCredentials;
  displayName: string;
  otherName: string;
  onHangUp: () => void;
}> = ({ credentials, displayName, otherName, onHangUp }) => {
  const t = useChymeTokens();
  const { client, call, status, errorDetail } = useBackChannelJoin(credentials, displayName);
  const shellStyle = [styles.shell, { borderRadius: t.radius(16) }];

  if (status !== 'joined' || !client || !call) {
    return (
      <View accessibilityLabel="Back Channel call" style={shellStyle}>
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>Back Channel</Text>
          <Text style={[styles.pendingText, { color: status === 'error' ? '#f87171' : '#9ca3af' }]}>
            {status === 'error' ? `Could not connect to the call: ${errorDetail ?? 'no reason was given.'}` : 'Connecting…'}
          </Text>
          <TouchableOpacity onPress={onHangUp} style={[styles.hangUp, { borderRadius: t.radius(10) }]} accessibilityRole="button">
            <PhoneOff size={14} color="#ef4444" />
            <Text style={styles.hangUpText}>{status === 'error' ? 'Close' : 'Cancel'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View accessibilityLabel="Back Channel call" style={shellStyle}>
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <BackChannelPanelLive otherName={otherName} onHangUp={onHangUp} t={t} />
        </StreamCall>
      </StreamVideo>
    </View>
  );
};

function useElapsedSeconds(): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return elapsed;
}

const BackChannelPanelLive: React.FC<{ otherName: string; onHangUp: () => void; t: ChymeTokens }> = ({ otherName, onHangUp, t }) => {
  const { useMicrophoneState, useParticipants } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  const participants = useParticipants();
  const call = useCall();
  const elapsed = useElapsedSeconds();
  const remoteSpeaking = useMemo(() => participants.some((p) => !p.isLocalParticipant && p.isSpeaking), [participants]);
  const hangUp = () => {
    void (async () => {
      try { await call?.leave(); } catch { /* no-trace: the call was already left */ }
      onHangUp();
    })();
  };

  return (
    <>
      <View style={styles.bar}>
        <PulseDot size={7} color={PRIMARY} />
        <Text style={styles.barTitle}>Back Channel</Text>
        <Text style={styles.barTime}>{formatElapsed(elapsed)}</Text>
      </View>

      <View style={styles.who}>
        <View style={[styles.avatar, { borderRadius: t.radius(22) }]}>
          <Text style={styles.avatarInitials}>{initials(otherName)}</Text>
        </View>
        <View style={styles.whoText}>
          <Text style={styles.otherName} numberOfLines={1}>{otherName}</Text>
          <View style={styles.speakingRow}>
            <Mic size={11} color={remoteSpeaking ? PRIMARY : '#6b7280'} />
            <Text style={[styles.speakingText, { color: remoteSpeaking ? PRIMARY : '#6b7280' }]}>{remoteSpeaking ? 'speaking' : 'listening'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={() => void microphone.toggle()} style={[styles.mute, { borderRadius: t.radius(10) }]} accessibilityRole="button">
          {isMute ? <MicOff size={14} color="#d5d9e2" /> : <Mic size={14} color="#d5d9e2" />}
          <Text style={styles.muteText}>{isMute ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={hangUp} style={[styles.hangUp, styles.flex, { borderRadius: t.radius(10) }]} accessibilityRole="button">
          <PhoneOff size={14} color="#ef4444" />
          <Text style={styles.hangUpText}>Hang up</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.noteWrap}>
        <View style={[styles.note, { borderRadius: t.radius(8) }]}>
          <Info size={12} color="#6b7280" style={styles.noteIcon} />
          <Text style={styles.noteText}>
            For calls with ServiceCredits attached, use <Text style={styles.noteLink}>Foundation</Text> instead.
          </Text>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    zIndex: 55,
    bottom: 16,
    left: 12,
    width: 288,
    maxWidth: '94%',
    overflow: 'hidden',
    backgroundColor: '#0d0f14',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    elevation: 12,
  },
  flex: { flex: 1 },
  pending: { padding: 16, gap: 12 },
  pendingTitle: { fontSize: 12, color: PRIMARY, fontFamily: interFamily('700') },
  pendingText: { fontSize: 12, fontFamily: interFamily('400') },
  hangUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(185,28,28,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  hangUpText: { fontSize: 13, color: '#ef4444', fontFamily: interFamily('600') },
  bar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34,197,94,0.2)',
  },
  barTitle: { fontSize: 12, color: PRIMARY, fontFamily: interFamily('700') },
  barTime: { marginLeft: 'auto', fontSize: 11, color: '#4b5563', fontVariant: ['tabular-nums'], fontFamily: interFamily('400') },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 10 },
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 15, color: PRIMARY, fontFamily: interFamily('800') },
  whoText: { flex: 1, minWidth: 0 },
  otherName: { fontSize: 13, color: '#d5d9e2', fontFamily: interFamily('600') },
  speakingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  speakingText: { fontSize: 11, fontFamily: interFamily('400') },
  controls: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  mute: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 9,
    backgroundColor: 'rgba(249,250,251,0.07)',
  },
  muteText: { fontSize: 12, color: '#d5d9e2', fontFamily: interFamily('600') },
  noteWrap: { paddingHorizontal: 14, paddingBottom: 12 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(249,250,251,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(249,250,251,0.07)',
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontSize: 10, lineHeight: 14, color: '#9ca3af', fontFamily: interFamily('400') },
  noteLink: { color: PRIMARY, fontFamily: interFamily('600') },
});
