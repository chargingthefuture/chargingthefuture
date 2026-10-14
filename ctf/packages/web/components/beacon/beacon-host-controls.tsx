'use client';

// The Beacon host's broadcast controls, inside the admin page: go live from this browser with the
// camera and microphone (a phone works, like a Twitch or TikTok live), or share a screen or window
// from a computer. The page joins the call only when one of these is pressed, so an admin who just
// has the page open is never counted as a silent broadcaster (owner report: a recording made of
// nothing, started by the admin page joining with no camera, microphone or screen).
import { useEffect, useRef, useState } from 'react';
import { CallingState, useCallStateHooks, type Call } from '@stream-io/video-react-sdk';
import { ScreenShare, ScreenShareOff, SwitchCamera, Video, VideoOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getBeaconTokens, type BeaconTokens } from './beacon-shared';
import { useBeaconEgressStart } from './use-beacon-egress-start';
import { reportError } from 'lib/observability/report';

// Screen capture exists only where the browser offers it; phone browsers do not.
function canShareScreen(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

async function joinIfNeeded(call: Call): Promise<void> {
  const state = call.state.callingState;
  if (state !== CallingState.JOINED && state !== CallingState.JOINING) {
    await call.join();
  }
}

function controlStyle(t: BeaconTokens, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 10,
    background: active ? 'rgba(239,68,68,0.14)' : `${t.ACCENT}20`,
    border: `1px solid ${active ? 'rgba(239,68,68,0.35)' : `${t.ACCENT}55`}`,
    color: active ? '#F87171' : t.ACCENT,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  };
}

// The host's own camera, shown back to them so they can frame the shot. Muted so the phone does not
// play the microphone back into itself.
function CameraPreview({ stream }: { stream: MediaStream | undefined }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);
  if (!stream) {
    return null;
  }
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000', objectFit: 'contain' }}
    />
  );
}

export function BeaconHostControls({ call, eventId }: { call: Call; eventId: string }) {
  const { theme } = useTheme();
  const t = getBeaconTokens(theme);
  const { useCameraState, useMicrophoneState, useScreenShareState, useHasOngoingScreenShare } = useCallStateHooks();
  const { camera, isMute: cameraOff, mediaStream } = useCameraState();
  const { microphone, isMute: micOff } = useMicrophoneState();
  const { screenShare, isMute: screenOff } = useScreenShareState();
  const isSharing = useHasOngoingScreenShare();
  const [busy, setBusy] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const onCamera = !cameraOff || !micOff;
  const publishing = onCamera || isSharing;
  const broadcastError = useBeaconEgressStart(eventId, publishing);

  const run = async (op: string, action: () => Promise<void>) => {
    setBusy(true);
    setDeviceError(null);
    try {
      await action();
    } catch (error) {
      reportError(error, { area: 'beacon', op, extra: { eventId } });
      setDeviceError(error instanceof Error ? error.message : 'The browser refused the camera, microphone or screen.');
    } finally {
      setBusy(false);
    }
  };

  // Turn the camera and microphone on before joining, so the first thing the call sees from this
  // host is real picture and sound.
  const toggleCamera = () =>
    run('host_camera', async () => {
      if (onCamera) {
        await camera.disable();
        await microphone.disable();
        return;
      }
      await camera.enable();
      await microphone.enable();
      await joinIfNeeded(call);
    });

  const toggleScreen = () =>
    run('host_screen_share', async () => {
      await joinIfNeeded(call);
      await screenShare.toggle();
    });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <CameraPreview stream={onCamera ? mediaStream : undefined} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ControlButton t={t} busy={busy} active={onCamera} onPress={toggleCamera} {...CAMERA_BUTTON[String(onCamera)]} />
        {onCamera ? (
          <ControlButton t={t} busy={busy} active={false} onPress={() => run('host_camera_flip', () => camera.flip())}
            icon={<SwitchCamera size={18} />} label="Flip camera" />
        ) : null}
        {canShareScreen() ? (
          <ControlButton t={t} busy={busy} active={!screenOff} onPress={toggleScreen} {...SCREEN_BUTTON[String(!screenOff)]} />
        ) : null}
      </div>
      <StatusLine t={t} error={broadcastError ?? deviceError} onCamera={onCamera} isSharing={isSharing} />
    </div>
  );
}

// Each toggle's icon and label, keyed by whether it is on.
const CAMERA_BUTTON: Record<string, { icon: React.ReactNode; label: string }> = {
  true: { icon: <VideoOff size={18} />, label: 'Stop camera and microphone' },
  false: { icon: <Video size={18} />, label: 'Use camera and microphone' },
};
const SCREEN_BUTTON: Record<string, { icon: React.ReactNode; label: string }> = {
  true: { icon: <ScreenShareOff size={18} />, label: 'Stop sharing' },
  false: { icon: <ScreenShare size={18} />, label: 'Share screen' },
};

function ControlButton({ t, busy, active, onPress, icon, label }: {
  t: BeaconTokens;
  busy: boolean;
  active: boolean;
  onPress: () => Promise<void>;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button type="button" disabled={busy} onClick={() => void onPress()} style={controlStyle(t, active)}>
      {icon}
      {label}
    </button>
  );
}

// What the host is sending, or why the broadcast did not start. An error replaces the "live" line,
// which would be untrue while no public feed or recording has started.
function StatusLine({ t, error, onCamera, isSharing }: { t: BeaconTokens; error: string | null; onCamera: boolean; isSharing: boolean }) {
  if (error) {
    return <span role="alert" style={{ fontSize: 13, color: '#F87171' }}>{error}</span>;
  }
  const text = onCamera
    ? 'Your camera and microphone are live to the broadcast.'
    : isSharing
      ? 'Your screen is live to the broadcast.'
      : 'Go live with your camera and microphone, from a phone or a computer.';
  return <span style={{ fontSize: 13, color: t.SUBTLE }}>{text}</span>;
}
