'use client';

import { useEffect, useState } from 'react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantsAudio,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-sdk';
import { Radio } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';
import { reportError } from 'lib/observability/report';
import type { StreamJoinCredentials } from 'lib/chyme/stream';
import { CHYME_CALL_TYPE, toCallIdForChyme, isWebRtcAvailable } from './chyme-audio-room';
import { useAudioCallKeepAlive } from './use-audio-call-keep-alive';

// A first join can fail for reasons that clear on their own: the guest Stream identity was minted
// milliseconds earlier and has not propagated, the SFU is mid-reconnect, or the network blipped
// while the page was still loading. Before this, one such failure ended the visit — the guest saw
// "try refreshing" and nothing retried. Three attempts with a widening gap cover the transient
// cases without hammering Stream when the failure is real.
const GUEST_JOIN_ATTEMPTS = 3;
const GUEST_JOIN_RETRY_BASE_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Join the live call, retrying the transient failures described above. Returns `null` once joined,
// or the last error. `create: false` — a guest only ever joins an existing live call, never starts
// one. Kept out of the component so the effect below stays readable (rule 116).
async function joinLiveCall(activeCall: Call, isCanceled: () => boolean): Promise<unknown | null> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= GUEST_JOIN_ATTEMPTS; attempt += 1) {
    try {
      await activeCall.join({ create: false });
      return null;
    } catch (error) {
      lastError = error;
      if (isCanceled() || attempt === GUEST_JOIN_ATTEMPTS) {
        return lastError;
      }
      await delay(GUEST_JOIN_RETRY_BASE_MS * attempt);
    }
  }
  return lastError;
}

// Did the room end between the server minting the guest token and the guest trying to use it? The
// room counts as "live" whenever a member's presence row is fresh, which outlives their actual
// Stream connection by up to the presence window — so a join can fail simply because there is no
// longer a call to join. Re-reading the public room tells that apart from a genuine fault.
async function isRoomStillLive(): Promise<boolean> {
  try {
    const res = await fetch('/api/chyme/public/room');
    if (!res.ok) {
      return true;
    }
    const data = await res.json();
    return data?.ok ? !!data.isLive : true;
  } catch {
    // Can't tell — treat it as still live so a network blip doesn't hide a room that is up.
    return true;
  }
}

// Signed-out listener. Connects an ephemeral guest Stream identity to the SAME call members are in
// and plays its audio — receive-only. The guest never publishes: camera and microphone are disabled
// and there is no unmute/raise-hand control, so this is listen-only on the client. Speaking requires
// signing in.
export function ChymeGuestListen({
  credentials,
  participantCount,
  accent = '#22C55E',
  onRoomGone,
}: {
  credentials: StreamJoinCredentials;
  participantCount: number;
  accent?: string;
  // Called when the join failed and a fresh read of the public room says the room is no longer
  // live. The parent then drops back to the honest "no public rooms right now" view instead of
  // leaving a dead error box under a room heading that claims the visitor is listening.
  onRoomGone?: () => void;
}) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error' | 'unsupported'>('connecting');
  // The verbatim reason the join failed. The member room already shows its Stream error this way;
  // the guest path used to swallow it, so a visitor (and the person they report it to) had nothing
  // to go on but "try refreshing".
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    // No WebRTC (Safari Lockdown Mode, some hardened/older browsers) → the Stream Video SDK can't
    // connect. Detect it up front and show a clear message rather than a raw error or a misleading
    // "try refreshing". Expected environment state, so it is not reported to Sentry.
    if (!isWebRtcAvailable()) {
      setStatus('unsupported');
      return;
    }

    let canceled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: 'Guest listener' },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(CHYME_CALL_TYPE, toCallIdForChyme(credentials.streamChannelId));

    void (async () => {
      // Disable the mic and camera BEFORE joining so the browser never prompts a guest for device
      // access — they can only listen, so there is nothing to publish and no reason to ask.
      try { await activeCall.camera.disable(); } catch { /* no camera */ }
      try { await activeCall.microphone.disable(); } catch { /* already muted */ }

      const joinError = await joinLiveCall(activeCall, () => canceled);
      if (canceled) {
        return;
      }
      if (!joinError) {
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
        return;
      }

      const stillLive = await isRoomStillLive();
      if (canceled) {
        return;
      }
      if (!stillLive) {
        // The room ended while we were connecting. Expected, not a fault, so it is not reported.
        onRoomGone?.();
        return;
      }

      reportError(joinError, {
        area: 'chyme',
        op: 'guest_listen_join',
        extra: {
          streamUserId: credentials.streamUserId,
          callType: CHYME_CALL_TYPE,
          callId: toCallIdForChyme(credentials.streamChannelId),
          attempts: GUEST_JOIN_ATTEMPTS,
        },
      });
      setErrorDetail(describeError(joinError));
      setStatus('error');
    })();

    return () => {
      canceled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* already left */ }
        try { await videoClient.disconnectUser(); } catch { /* ignore */ }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamToken, credentials.streamUserId, credentials.streamChannelId, onRoomGone]);

  // While listening and the tab is foreground, hold a screen wake lock + Media Session presence so
  // the OS keeps the audio prioritized and the screen doesn't sleep out from under playback. This is
  // the closest a browser gets to the native Android background service; it does not survive a fully
  // backgrounded/locked page.
  useAudioCallKeepAlive(status === 'joined', 'Chyme live listen');

  if (status === 'unsupported') {
    return (
      <GuestNote
        accent={accent}
        text="Live audio needs WebRTC, which this browser has turned off — on iPhone or iPad this usually means Safari Lockdown Mode. Turn it off for this site (address bar → aA → Website Settings) or use another browser to listen."
      />
    );
  }
  if (status === 'error') {
    return <GuestNote accent={accent} text="Couldn't connect to the live room. Try refreshing." detail={errorDetail} />;
  }
  if (status !== 'joined' || !client || !call) {
    return <GuestNote accent={accent} text="Connecting to the live room…" />;
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <GuestAudioSink accent={accent} participantCount={participantCount} />
      </StreamCall>
    </StreamVideo>
  );
}

// Exported so the public shell can show the same note when the room is live but no guest identity
// could be minted — one look for "you are not hearing this room, and here is why".
export function GuestNote({ accent, text, detail }: { accent: string; text: string; detail?: string | null }) {
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 18px', borderRadius: 12, background: `${accent}12`, border: `1px solid ${accent}30`, color: t.SUBTLE, fontSize: 13 }}>
      <Radio size={16} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div>{text}</div>
        {detail ? (
          <div style={{ marginTop: 6, fontSize: 11, color: t.MUTED, lineHeight: 1.5, wordBreak: 'break-word' }}>{detail}</div>
        ) : null}
      </div>
    </div>
  );
}

function GuestAudioSink({ accent, participantCount }: { accent: string; participantCount: number }) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const { theme } = useTheme();
  const t = getChymeTokens(theme);
  // Show the authoritative server-side count (the same number the room list shows). The Stream client
  // participant list counts every connected identity — including the guest's own ephemeral session and
  // any guest sessions Stream has not yet timed out — which over-counts and is inconsistent with the
  // rest of the UI. The Stream list is still used below, but only to play each participant's audio.
  const count = participantCount;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}35`, color: t.TITLE, fontSize: 13, fontWeight: 600 }}>
      <Radio size={16} style={{ color: accent }} />
      Listening live · {count} {count === 1 ? 'person' : 'people'} on stage
      {/* Headless audio sink — plays every participant's audio track. */}
      <ParticipantsAudio participants={participants} />
    </div>
  );
}
