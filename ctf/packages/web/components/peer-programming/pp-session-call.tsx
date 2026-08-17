'use client';

// Live video session for a PeerProgramming cohort. Joins the cohort's GetStream
// (Stream) video call using credentials minted by POST /api/peer-programming/session/join,
// and renders one video tile per participant. Camera and microphone start enabled so
// joining puts the member on screen; they can mute/stop from the controls.
import { useEffect, useMemo, useState } from 'react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantView,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-react-sdk';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getPeerProgrammingTokens, type PeerProgrammingTokens } from './pp-shared';
import { reportError } from 'lib/observability/report';

const CALL_TYPE = 'default';

// Scoped to `.pp-participant-tile` so it only affects our cohort video tiles, not the rest of the app.
// The Stream SDK's own stylesheet (which would normally do this) is not imported here, so we size the
// participant wrapper and its <video> to fill the tile and center-crop instead of overflowing at native
// resolution. `!important` overrides the inline width/height Stream sets on the video element itself.
const PARTICIPANT_TILE_CSS = `
.pp-participant-tile,
.pp-participant-tile .str-video__participant-view {
  width: 100%;
  height: 100%;
}
.pp-participant-tile video {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  object-position: center;
}
`;

export type PeerProgrammingSessionCredentials = {
  cohortId: string;
  displayName: string;
  streamApiKey: string;
  streamCallId: string;
  streamUserId: string;
  streamToken: string;
};

export function PeerProgrammingSessionCall({
  credentials,
  displayName,
  onLeave,
}: {
  credentials: PeerProgrammingSessionCredentials;
  displayName: string;
  onLeave: () => void;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: displayName },
      token: credentials.streamToken,
    });
    const activeCall = videoClient.call(CALL_TYPE, credentials.streamCallId);

    void (async () => {
      try {
        await activeCall.join({ create: true });
        try { await activeCall.camera.enable(); } catch { /* no camera available */ }
        try { await activeCall.microphone.enable(); } catch { /* no mic available */ }
        if (canceled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (error) {
        if (canceled) return;
        reportError(error, {
          area: 'peer-programming',
          op: 'session_join_client',
          extra: { callId: credentials.streamCallId, streamUserId: credentials.streamUserId },
        });
        setErrorMessage(error instanceof Error ? error.message : 'Could not connect to the live session.');
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
  }, [credentials.streamApiKey, credentials.streamToken, credentials.streamUserId, credentials.streamCallId, displayName]);

  if (status !== 'joined' || !client || !call) {
    return (
      <div style={{ padding: '60px 0', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${t.ACCENT}30`, textAlign: 'center' }}>
        <VideoIcon size={48} style={{ color: t.ACCENT, display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 15, color: status === 'error' ? '#F87171' : t.SUBTLE }}>
          {status === 'error' ? (errorMessage ?? 'Could not connect to the live session.') : 'Connecting to the live session…'}
        </div>
        {status === 'error' && (
          <button type="button" onClick={onLeave} style={leaveButtonStyle}>Back</button>
        )}
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <PeerProgrammingSessionStage onLeave={onLeave} />
      </StreamCall>
    </StreamVideo>
  );
}

const leaveButtonStyle: React.CSSProperties = {
  marginTop: 16,
  padding: '10px 22px',
  borderRadius: 10,
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#F87171',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

function PeerProgrammingSessionStage({ onLeave }: { onLeave: () => void }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const { useParticipants, useCameraState, useMicrophoneState } = useCallStateHooks();
  const participants = useParticipants();
  const { camera, isMute: cameraOff } = useCameraState();
  const { microphone, isMute: micOff } = useMicrophoneState();

  // One tile per user — a lingering extra session would otherwise double a member up.
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
    <div>
      {/* This app does not import the Stream video SDK stylesheet, so ParticipantView's inner <video>
          has no size and renders at the camera's native resolution — the tile's overflow:hidden then
          crops it to a corner, which looks "zoomed in". Size the video (and Stream's wrapper) to the
          tile and center-crop it so each participant is framed like a normal video-call tile. */}
      <style>{PARTICIPANT_TILE_CSS}</style>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: t.MUTED, textTransform: 'uppercase', marginBottom: 14 }}>
        Live · {uniqueParticipants.length} {uniqueParticipants.length === 1 ? 'participant' : 'participants'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {uniqueParticipants.map((participant) => (
          <div key={participant.sessionId} className="pp-participant-tile" style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.ACCENT}25`, background: '#000', aspectRatio: '4 / 3' }}>
            <ParticipantView participant={participant} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
        <button type="button" onClick={() => void microphone.toggle()} aria-label={micOff ? 'Unmute' : 'Mute'} style={controlStyle(micOff, t)}>
          {micOff ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button type="button" onClick={() => void camera.toggle()} aria-label={cameraOff ? 'Start camera' : 'Stop camera'} style={controlStyle(cameraOff, t)}>
          {cameraOff ? <VideoOff size={18} /> : <VideoIcon size={18} />}
        </button>
        <button type="button" onClick={onLeave} aria-label="Leave session" style={{ ...controlStyle(true, t), background: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.35)', color: '#F87171' }}>
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}

function controlStyle(active: boolean, t: PeerProgrammingTokens): React.CSSProperties {
  return {
    width: 46,
    height: 46,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: active ? t.BORDER : `${t.ACCENT}20`,
    border: `1px solid ${active ? 'rgba(255,255,255,0.12)' : `${t.ACCENT}40`}`,
    color: active ? t.SUBTLE : t.ACCENT,
  };
}
