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
import { reportError } from 'lib/observability/report';
import type { StreamJoinCredentials } from 'lib/chyme/stream';
import { CHYME_CALL_TYPE, toCallIdForChyme } from './chyme-audio-room';

// Signed-out listener. Connects an ephemeral guest Stream identity to the SAME call members are in
// and plays its audio — receive-only. The guest never publishes: camera and microphone are disabled
// and there is no unmute/raise-hand control, so this is listen-only on the client. Speaking requires
// signing in.
export function ChymeGuestListen({
  credentials,
  accent = '#22C55E',
}: {
  credentials: StreamJoinCredentials;
  accent?: string;
}) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');

  useEffect(() => {
    let cancelled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: 'Guest listener' },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(CHYME_CALL_TYPE, toCallIdForChyme(credentials.streamChannelId));

    void (async () => {
      try {
        // Disable the mic and camera BEFORE joining so the browser never prompts a guest for device
        // access — they can only listen, so there is nothing to publish and no reason to ask.
        try { await activeCall.camera.disable(); } catch { /* no camera */ }
        try { await activeCall.microphone.disable(); } catch { /* already muted */ }
        // create: false — a guest only ever joins an existing live call, never starts one.
        await activeCall.join({ create: false });
        if (cancelled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (error) {
        if (cancelled) return;
        reportError(error, { area: 'chyme', op: 'guest_listen_join', extra: { streamUserId: credentials.streamUserId } });
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
  }, [credentials.streamApiKey, credentials.streamToken, credentials.streamUserId, credentials.streamChannelId]);

  if (status === 'error') {
    return <GuestNote accent={accent} text="Couldn't connect to the live room. Try refreshing." />;
  }
  if (status !== 'joined' || !client || !call) {
    return <GuestNote accent={accent} text="Connecting to the live room…" />;
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <GuestAudioSink accent={accent} />
      </StreamCall>
    </StreamVideo>
  );
}

function GuestNote({ accent, text }: { accent: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, background: `${accent}12`, border: `1px solid ${accent}30`, color: '#9CA3AF', fontSize: 13 }}>
      <Radio size={16} style={{ color: accent }} /> {text}
    </div>
  );
}

function GuestAudioSink({ accent }: { accent: string }) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const count = participants.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}35`, color: '#F0FDF4', fontSize: 13, fontWeight: 600 }}>
      <Radio size={16} style={{ color: accent }} />
      Listening live · {count} {count === 1 ? 'person' : 'people'} on stage
      {/* Headless audio sink — plays every participant's audio track. */}
      <ParticipantsAudio participants={participants} />
    </div>
  );
}
