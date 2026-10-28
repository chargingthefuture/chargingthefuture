'use client';

// Live video session for a PeerProgramming cohort, on the cohort's GetStream (Stream) video call using
// credentials minted by POST /api/peer-programming/session/join. The member first sees their own
// camera, with the camera, microphone and background blur to set (pp-call-lobby.tsx), then joins and
// gets one tile per participant. On another member's tile: Block and report. Picture in picture
// keeps the call in its own window, and the browser opens it there on its own when it supports that.
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { BlockAndReportButton, BlurBackgroundToggle, CallFiltersProvider, openPictureInPicture } from '@/components/shared/call-safety';
import { PeerProgrammingCallLobby } from './pp-call-lobby';

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

// Browser error names that mean the device is simply not there. Anything else (most often a blocked
// permission) is something the member can fix, so it is named on screen and reported.
const MISSING_DEVICE_ERRORS = new Set(['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError']);
const BLOCKED_DEVICE_ERRORS = new Set(['NotAllowedError', 'PermissionDeniedError', 'SecurityError']);

type DeviceKind = 'camera' | 'microphone';

// Turn the camera or microphone on after joining. Returns null when it started, or a sentence for the
// call stage saying which device did not start and the browser's reason. A missing device is not an
// incident and is not reported; every other failure is.
async function startDevice(kind: DeviceKind, enable: () => Promise<void>, callId: string): Promise<string | null> {
  try {
    await enable();
    return null;
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (MISSING_DEVICE_ERRORS.has(name)) {
      return `No ${kind} was found, so you joined without it.`;
    }
    reportError(error, { area: 'peer-programming', op: `session_${kind}_enable`, extra: { callId, errorName: name } });
    const reason = error instanceof Error && error.message ? error.message : String(error);
    if (BLOCKED_DEVICE_ERRORS.has(name)) {
      return `Your ${kind} is blocked for this site (${reason}). Allow it in your browser's site settings, then turn it on with the button below.`;
    }
    return `Your ${kind} could not start (${reason}).`;
  }
}

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
  const [status, setStatus] = useState<'connecting' | 'lobby' | 'joined' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceNotices, setDeviceNotices] = useState<string[]>([]);

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
        // The devices start before joining so the member can check them first.
        const cameraNotice = await startDevice('camera', () => activeCall.camera.enable(), credentials.streamCallId);
        const micNotice = await startDevice('microphone', () => activeCall.microphone.enable(), credentials.streamCallId);
        if (canceled) return;
        setDeviceNotices([cameraNotice, micNotice].filter((notice): notice is string => notice !== null));
        setClient(videoClient);
        setCall(activeCall);
        setStatus('lobby');
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

  const join = async () => {
    if (!call) return;
    try {
      await call.join({ create: true });
      setStatus('joined');
    } catch (error) {
      reportError(error, { area: 'peer-programming', op: 'session_join_client', extra: { callId: credentials.streamCallId } });
      setErrorMessage(error instanceof Error ? error.message : 'Could not connect to the live session.');
      setStatus('error');
    }
  };

  if (status === 'connecting' || status === 'error' || !client || !call) {
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
        <CallFiltersProvider area="peer-programming">
          {status === 'lobby' ? (
            <>
              <style>{PARTICIPANT_TILE_CSS}</style>
              <PeerProgrammingCallLobby deviceNotices={deviceNotices} onJoin={join} onCancel={onLeave} />
            </>
          ) : (
            <PeerProgrammingSessionStage onLeave={onLeave} deviceNotices={deviceNotices} />
          )}
        </CallFiltersProvider>
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

function PeerProgrammingSessionStage({ onLeave, deviceNotices }: { onLeave: () => void; deviceNotices: string[] }) {
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
  const remoteTile = useRef<HTMLDivElement | null>(null);
  const [pipNotice, setPipNotice] = useAutoPictureInPicture(remoteTile);

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
      {deviceNotices.map((notice) => (
        <div key={notice} role="status" style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontSize: 13, lineHeight: 1.5 }}>
          {notice}
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {uniqueParticipants.map((participant) => (
          <div key={participant.sessionId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              ref={participant.isLocalParticipant || remoteTile.current ? undefined : remoteTile}
              className="pp-participant-tile"
              style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.ACCENT}25`, background: '#000', aspectRatio: '4 / 3' }}
            >
              <ParticipantView participant={participant} />
            </div>
            {participant.isLocalParticipant ? null : (
              <BlockAndReportButton accountId={accountIdOf(participant.userId)} name={participant.name || 'this member'} onDone={onLeave} color="#F87171" />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <BlurBackgroundToggle color={t.ACCENT} border={`${t.ACCENT}40`} />
        {uniqueParticipants.length > 1 ? (
          <button
            type="button"
            onClick={() => void openPictureInPicture(remoteTile.current).then(setPipNotice)}
            style={{ minHeight: 40, padding: '6px 14px', borderRadius: 999, border: `1px solid ${t.ACCENT}40`, background: 'transparent', color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Picture in picture
          </button>
        ) : null}
      </div>
      {pipNotice ? <div role="status" style={{ marginTop: 8, fontSize: 12, color: t.SUBTLE, textAlign: 'center' }}>{pipNotice}</div> : null}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
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

// PeerProgramming Stream ids are `pp-<accountId>` (lib/peer-programming/stream.ts).
function accountIdOf(streamUserId: string): string {
  return streamUserId.startsWith('pp-') ? streamUserId.slice('pp-'.length) : streamUserId;
}

// Picture in picture by default: where the browser lets a page open it on its own (Chrome, for a
// video call that is hidden behind another tab or app), the other member's video moves to its own
// window. Elsewhere the button does it.
function useAutoPictureInPicture(tile: React.RefObject<HTMLDivElement | null>): [string | null, (notice: string | null) => void] {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!session) return;
    const action = 'enterpictureinpicture' as MediaSessionAction;
    try {
      session.setActionHandler(action, () => void openPictureInPicture(tile.current).then(setNotice));
    } catch {
      return; // This browser does not offer it; the button still works.
    }
    // Only reached when the handler was set, so clearing it is supported too.
    return () => session.setActionHandler(action, null);
  }, [tile]);
  return [notice, setNotice];
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
