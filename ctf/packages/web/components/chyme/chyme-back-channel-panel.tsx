'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantsAudio,
  useCall,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-sdk';
import { Mic, MicOff, PhoneOff, Info } from 'lucide-react';
import { PRIMARY, initials, chymeHandle, type CurrentUser } from './chyme-shared';
import { reportError } from 'lib/observability/report';
import { useAudioCallKeepAlive } from './use-audio-call-keep-alive';
import type { ChymeBackChannelJoinCredentials } from 'lib/chyme/types';

// Screen 2 (desktop) of the handoff: a floating mini-panel shown while a Back Channel call is live, so
// the room stays fully usable behind it. Audio-only, 1:1 — its own Stream Video call, separate from the
// room call. On phone-width web it drops to the bottom-left as a compact card. The Foundation note is
// required on every call surface (spec): casual calls are free here; paid consultations live in Foundation.

// Same 'default' call type as the Chyme room; a 1:1 audio call needs no host/backstage grant.
const BACK_CHANNEL_CALL_TYPE = 'default';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ChymeBackChannelPanel({
  credentials,
  currentUser,
  otherName,
  onHangUp,
}: {
  credentials: ChymeBackChannelJoinCredentials;
  currentUser: CurrentUser;
  otherName: string;
  isMobile: boolean;
  onHangUp: () => void;
}) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');

  useEffect(() => {
    let canceled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: chymeHandle(currentUser.username, currentUser.userId) },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(BACK_CHANNEL_CALL_TYPE, credentials.streamCallId);
    void (async () => {
      try {
        // Disable the camera BEFORE joining so the browser never asks for camera permission (audio
        // only). iOS prompts the moment the SDK requests a video track, so disabling after join is too
        // late. Mic is enabled after join because a 1:1 call is a conversation — both people talk.
        try { await activeCall.camera.disable(); } catch { /* no camera */ }
        await activeCall.join({ create: true });
        // A 1:1 call is a conversation — unlike the room, join UN-muted so both people can talk.
        try { await activeCall.microphone.enable(); } catch { /* mic unavailable */ }
        if (canceled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (error) {
        if (canceled) return;
        reportError(error, { area: 'chyme', op: 'back_channel_join_stream', extra: { callId: credentials.streamCallId } });
        setStatus('error');
      }
    })();
    return () => {
      canceled = true;
      void (async () => {
        try { await activeCall.leave(); } catch { /* already left */ }
        try { await videoClient.disconnectUser(); } catch { /* ignore */ }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamToken, credentials.streamUserId, credentials.streamCallId, currentUser.username, currentUser.userId]);

  // Same best-effort keep-alive as the main room: while the 1:1 call is joined and the tab is
  // foreground, hold a screen wake lock + Media Session presence.
  useAudioCallKeepAlive(status === 'joined', 'Chyme back channel');

  const shell = (children: React.ReactNode) => (
    <div
      role="dialog"
      aria-label="Back Channel call"
      style={{
        position: 'fixed',
        zIndex: 55,
        bottom: 16,
        left: 12,
        right: 16,
        width: 288,
        maxWidth: 'calc(100vw - 24px)',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#0d0f14',
        border: '1px solid rgba(34,197,94,0.35)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        animation: 'bc-float-in 0.25s ease-out',
      }}
    >
      {children}
    </div>
  );

  if (status !== 'joined' || !client || !call) {
    return shell(
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>Back Channel</div>
        <div style={{ fontSize: 12, color: status === 'error' ? '#f87171' : '#9ca3af' }}>
          {status === 'error' ? 'Could not connect to the call.' : 'Connecting…'}
        </div>
        <button type="button" onClick={onHangUp} style={hangUpStyle}>
          <PhoneOff size={14} /> {status === 'error' ? 'Close' : 'Cancel'}
        </button>
      </div>,
    );
  }

  return shell(
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <BackChannelPanelLive otherName={otherName} onHangUp={onHangUp} />
      </StreamCall>
    </StreamVideo>,
  );
}

const hangUpStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '9px 12px',
  borderRadius: 10,
  background: 'rgba(185,28,28,0.2)',
  border: '1px solid rgba(239,68,68,0.4)',
  color: '#ef4444',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

function BackChannelPanelLive({ otherName, onHangUp }: { otherName: string; onHangUp: () => void }) {
  const { useMicrophoneState, useParticipants } = useCallStateHooks();
  const { microphone, isMute } = useMicrophoneState();
  const participants = useParticipants();
  const call = useCall();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // The remote participant's speaking state (anyone who is not the local member).
  const remoteSpeaking = useMemo(
    () => participants.some((p) => !p.isLocalParticipant && p.isSpeaking),
    [participants],
  );

  return (
    <>
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 14px',
          background: 'rgba(34,197,94,0.06)',
          borderBottom: '1px solid rgba(34,197,94,0.2)',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIMARY, animation: 'bc-pulse 1.4s ease-in-out infinite' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>Back Channel</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4b5563', fontVariantNumeric: 'tabular-nums' }}>{formatElapsed(elapsed)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 10px' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(34,197,94,0.18)',
            border: '2px solid rgba(34,197,94,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: PRIMARY }}>{initials(otherName)}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {otherName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: remoteSpeaking ? PRIMARY : '#6b7280' }}>
            <Mic size={11} /> {remoteSpeaking ? 'speaking' : 'listening'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}>
        <button
          type="button"
          onClick={() => void microphone.toggle()}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: 9,
            borderRadius: 10,
            background: 'rgba(249,250,251,0.07)',
            border: 'none',
            color: '#f9fafb',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isMute ? <MicOff size={14} /> : <Mic size={14} />} {isMute ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              try { await call?.leave(); } catch { /* already left */ }
              onHangUp();
            })();
          }}
          style={{ ...hangUpStyle, flex: 1 }}
        >
          <PhoneOff size={14} /> Hang up
        </button>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(249,250,251,0.04)',
            border: '1px solid rgba(249,250,251,0.07)',
          }}
        >
          <Info size={12} style={{ color: '#6b7280', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>
            For calls with ServiceCredits attached, use{' '}
            <a href="/apps/foundation" style={{ color: PRIMARY, fontWeight: 600 }}>Foundation</a> instead.
          </span>
        </div>
      </div>

      <ParticipantsAudio participants={participants} />
    </>
  );
}
