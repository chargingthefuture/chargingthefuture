// Signed-out listening, copied from the web (web components/chyme/chyme-guest-listen.tsx). On the
// tap the server mints this phone's guest Stream identity, which joins the SAME call members are in
// and plays it — receive-only: camera and microphone stay off and there is no speak control. While
// listening it keeps the presence heartbeat going; Leave posts the leave so the spot frees at once.
// The Android foreground service keeps the sound playing in the background, as for members.
//
// The web also handles a browser without WebRTC and the phone browser's autoplay rule (it unlocks
// audio inside the tap). The app always has WebRTC and plays call audio without a tap, so neither
// case occurs here; the "Tap to hear the room" button shows only if Stream reports blocked audio.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Radio } from 'lucide-react-native';
import { StreamVideo, StreamVideoClient, StreamCall, type Call } from '@stream-io/video-react-native-sdk';
import { interFamily } from '../../components/ui';
import { reportError } from '../../observability/report';
import { CALL_TYPE, toCallId } from './ChymeAudioRoom';
import { useChymeTokens } from './chyme-tokens';
import {
  GuestListenRefused,
  attendanceLine,
  isRoomStillLive,
  postGuestHeartbeat,
  postGuestLeave,
  requestGuestListenCredentials,
  type GuestCredentials,
  type GuestRoomCounts,
} from './chyme-public-api';
import { GuestAudioSink } from './chyme-guest-stage';

const GUEST_JOIN_ATTEMPTS = 3;
const GUEST_JOIN_RETRY_BASE_MS = 700;
const GUEST_HEARTBEAT_MS = 35_000;

type Status = 'idle' | 'connecting' | 'joined' | 'error';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// A first join can fail for reasons that clear on their own; three tries with a widening gap.
// `create: false`: a guest only joins an existing live call.
async function joinLiveCall(activeCall: Call, isCanceled: () => boolean): Promise<unknown | null> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= GUEST_JOIN_ATTEMPTS; attempt += 1) {
    try {
      await activeCall.join({ create: false });
      return null;
    } catch (error) {
      lastError = error;
      if (isCanceled() || attempt === GUEST_JOIN_ATTEMPTS) return lastError;
      await new Promise((resolve) => setTimeout(resolve, GUEST_JOIN_RETRY_BASE_MS * attempt));
    }
  }
  return lastError;
}

export function GuestNote({ accent, text, detail }: { accent: string; text: string; detail?: string | null }) {
  const t = useChymeTokens();
  return (
    <View style={[styles.note, { borderRadius: t.radius(12), backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}>
      <Radio size={16} color={accent} style={styles.icon} />
      <View style={styles.flex}>
        <Text style={[styles.noteText, { color: t.SUBTLE }]}>{text}</Text>
        {detail ? <Text style={[styles.detail, { color: t.MUTED }]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

function ListenButton({ accent, counts, onTap }: { accent: string; counts: GuestRoomCounts; onTap: () => void }) {
  const t = useChymeTokens();
  return (
    <TouchableOpacity onPress={onTap} accessibilityRole="button" style={[styles.note, { borderRadius: t.radius(12), backgroundColor: `${accent}14`, borderColor: `${accent}35` }]}>
      <Radio size={16} color={accent} style={styles.icon} />
      <View style={styles.flex}>
        <Text style={[styles.listenText, { color: t.TITLE }]}>Tap to listen · {attendanceLine(counts.participantCount, counts.guestCount)}</Text>
        <Text style={[styles.detail, { color: t.MUTED }]}>Phones only play sound after a tap. You will hear the room and cannot be heard.</Text>
      </View>
    </TouchableOpacity>
  );
}

// The tap → credentials step; a refusal shows the server's words, or drops back to the not-live
// view when the server said the room ended.
function useCredentials(armed: boolean, onRoomGone: () => void, onRefused: (_detail: string) => void, setCounts: (_c: GuestRoomCounts) => void) {
  const [credentials, setCredentials] = useState<GuestCredentials | null>(null);
  useEffect(() => {
    if (!armed || credentials) return;
    let canceled = false;
    void (async () => {
      try {
        const minted = await requestGuestListenCredentials();
        if (canceled) return;
        setCredentials(minted.credentials);
        if (minted.counts) setCounts(minted.counts);
      } catch (error) {
        if (canceled) return;
        if (error instanceof GuestListenRefused && error.roomGone) return onRoomGone();
        onRefused(describeError(error));
      }
    })();
    return () => {
      canceled = true;
    };
  }, [armed, credentials, onRoomGone, onRefused, setCounts]);
  return { credentials, setCredentials };
}

type JoinArgs = {
  armed: boolean;
  credentials: GuestCredentials | null;
  onRoomGone: () => void;
  onJoined: (_client: StreamVideoClient, _call: Call) => void;
  onFailed: (_detail: string) => void;
  rosterGoneRef: React.MutableRefObject<boolean>;
};

// Join with camera and microphone off; on failure, re-read the room to tell an ended room from a
// fault. The cleanup leaves the call and posts the leave, unless the server already dropped the row.
function useGuestJoin({ armed, credentials, onRoomGone, onJoined, onFailed, rosterGoneRef }: JoinArgs) {
  useEffect(() => {
    if (!armed || !credentials) return;
    let canceled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: 'Guest listener' },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, toCallId(credentials.streamChannelId));
    void (async () => {
      try { await activeCall.camera.disable(); } catch { /* no-trace: no camera */ }
      try { await activeCall.microphone.disable(); } catch { /* no-trace: already muted */ }
      const joinError = await joinLiveCall(activeCall, () => canceled);
      if (canceled) return;
      if (!joinError) return onJoined(videoClient, activeCall);
      const stillLive = await isRoomStillLive();
      if (canceled) return;
      if (!stillLive) return onRoomGone();
      reportError(joinError, { area: 'chyme', op: 'guest_listen_join', extra: { callId: toCallId(credentials.streamChannelId), attempts: GUEST_JOIN_ATTEMPTS } });
      onFailed(describeError(joinError));
    })();
    return () => {
      canceled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* no-trace: already left */ }
        try { await videoClient.disconnectUser(); } catch { /* no-trace: already disconnected */ }
      })();
      if (rosterGoneRef.current) rosterGoneRef.current = false;
      else postGuestLeave();
    };
  }, [armed, credentials, onRoomGone, onJoined, onFailed, rosterGoneRef]);
}

function useGuestHeartbeat(listening: boolean, onCounts: (_c: GuestRoomCounts) => void, onRosterGone: () => void) {
  useEffect(() => {
    if (!listening) return;
    const beat = () => postGuestHeartbeat(onCounts, onRosterGone);
    beat();
    const id = setInterval(beat, GUEST_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [listening, onCounts, onRosterGone]);
}

type ListenProps = {
  participantCount: number;
  guestCount: number;
  accent: string;
  onRoomGone: () => void;
  onListeningChange: (_listening: boolean) => void;
  leaveKey: number;
};

function useGuestListen({ participantCount, guestCount, onRoomGone, onListeningChange, leaveKey }: ListenProps) {
  const [counts, setCounts] = useState<GuestRoomCounts>({ participantCount, guestCount });
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [armed, setArmed] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const rosterGoneRef = useRef(false);

  const onFailed = useCallback((detail: string) => {
    setErrorDetail(detail);
    setStatus('error');
  }, []);
  const { credentials, setCredentials } = useCredentials(armed, onRoomGone, onFailed, setCounts);
  const onJoined = useCallback((c: StreamVideoClient, k: Call) => {
    setClient(c);
    setCall(k);
    setStatus('joined');
  }, []);
  useGuestJoin({ armed, credentials, onRoomGone, onJoined, onFailed, rosterGoneRef });

  const handleRosterGone = useCallback(() => {
    rosterGoneRef.current = true;
    setClient(null);
    setCall(null);
    setCredentials(null);
    setStatus('connecting');
  }, [setCredentials]);
  useGuestHeartbeat(status === 'joined', setCounts, handleRosterGone);

  const listeningRef = useRef(onListeningChange);
  useEffect(() => {
    listeningRef.current = onListeningChange;
  }, [onListeningChange]);
  useEffect(() => {
    listeningRef.current(status === 'joined');
    return () => listeningRef.current(false);
  }, [status]);

  // The page's Leave control: tear the call down and drop back to the listen button.
  useEffect(() => {
    if (leaveKey === 0) return;
    setArmed(false);
    setCredentials(null);
    setClient(null);
    setCall(null);
    setErrorDetail(null);
    setStatus('idle');
    setCounts((current) => ({ participantCount: current.participantCount, guestCount: Math.max(0, current.guestCount - 1) }));
  }, [leaveKey, setCredentials]);

  // The page's refresh re-reads the room; take that answer as the newer one.
  useEffect(() => {
    setCounts({ participantCount, guestCount });
  }, [participantCount, guestCount]);

  const arm = () => {
    setErrorDetail(null);
    setCredentials(null);
    setStatus('connecting');
    setArmed(true);
  };
  return { counts, client, call, status, errorDetail, arm };
}

export function ChymeGuestListen(props: ListenProps) {
  const t = useChymeTokens();
  const { counts, client, call, status, errorDetail, arm } = useGuestListen(props);
  const { accent } = props;
  if (status === 'idle') return <ListenButton accent={accent} counts={counts} onTap={arm} />;
  if (status === 'error') {
    return (
      <View style={styles.column}>
        <GuestNote accent={accent} text="Couldn't connect to the live room." detail={errorDetail} />
        <TouchableOpacity onPress={arm} accessibilityRole="button" style={[styles.retry, { borderRadius: t.radius(12), backgroundColor: accent }]}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (status !== 'joined' || !client || !call) return <GuestNote accent={accent} text="Connecting to the live room…" />;
  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <GuestAudioSink accent={accent} counts={counts} />
      </StreamCall>
    </StreamVideo>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, width: '100%', paddingVertical: 14, paddingHorizontal: 18, borderWidth: 1 },
  icon: { marginTop: 2 },
  flex: { flex: 1 },
  noteText: { fontSize: 13, fontFamily: interFamily('400') },
  listenText: { fontSize: 13, fontFamily: interFamily('600') },
  detail: { marginTop: 6, fontSize: 11, lineHeight: 16.5, fontFamily: interFamily('400') },
  column: { gap: 8 },
  retry: { width: '100%', paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  retryText: { color: '#fff', fontSize: 13, fontFamily: interFamily('700') },
});
