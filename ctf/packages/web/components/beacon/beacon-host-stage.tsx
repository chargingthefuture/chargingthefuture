'use client';

// Desktop in-browser screen-share publisher for the Beacon host. The admin captures a screen/window
// with the browser and publishes it into the same livestream call as the host. This is the
// computer-demo input path; the phone-demo path uses the RTMP url/key shown in the admin shell.
import { useEffect, useRef, useState } from 'react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-sdk';
import { ScreenShare, ScreenShareOff } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getBeaconTokens } from './beacon-shared';
import { reportError } from 'lib/observability/report';

export type BeaconHostCredentials = {
  streamApiKey: string;
  streamCallType: string;
  streamCallId: string;
  streamUserId: string;
  hostToken: string;
  displayName: string;
};

export function BeaconHostStage({ credentials, eventId }: { credentials: BeaconHostCredentials; eventId: string }) {
  const { theme } = useTheme();
  const t = getBeaconTokens(theme);
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<'connecting' | 'joined' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: credentials.displayName },
      token: credentials.hostToken,
    });
    const activeCall = videoClient.call(credentials.streamCallType, credentials.streamCallId);

    void (async () => {
      try {
        // Join as the host. The server has already created the call and gone live; joining here lets
        // the host publish the screen-share track into it.
        await activeCall.join();
        if (canceled) return;
        setClient(videoClient);
        setCall(activeCall);
        setStatus('joined');
      } catch (error) {
        if (canceled) return;
        reportError(error, { area: 'beacon', op: 'host_join_client', extra: { callId: credentials.streamCallId } });
        setErrorMessage(error instanceof Error ? error.message : 'Could not connect to the broadcast.');
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
  }, [credentials.streamApiKey, credentials.streamCallType, credentials.streamCallId, credentials.streamUserId, credentials.hostToken, credentials.displayName]);

  if (status !== 'joined' || !client || !call) {
    return (
      <div style={{ padding: '24px 0', color: status === 'error' ? '#F87171' : t.SUBTLE, fontSize: 14 }}>
        {status === 'error' ? (errorMessage ?? 'Could not connect to the broadcast.') : 'Connecting to the broadcast…'}
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <ScreenShareControls eventId={eventId} />
      </StreamCall>
    </StreamVideo>
  );
}

function ScreenShareControls({ eventId }: { eventId: string }) {
  const { theme } = useTheme();
  const t = getBeaconTokens(theme);
  const { useScreenShareState, useHasOngoingScreenShare } = useCallStateHooks();
  const { screenShare, isMute } = useScreenShareState();
  const isSharing = useHasOngoingScreenShare();
  // Start the public HLS broadcast + recording the first time a screen-share goes live in this
  // session. go-live alone only flips the call out of backstage; egress must start once media exists,
  // which is right here. The ref guards against firing more than once per share session and resets
  // when sharing stops so a later re-share starts egress again.
  const egressStartedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!isSharing) {
      egressStartedRef.current = false;
      return;
    }
    if (egressStartedRef.current) {
      return;
    }
    egressStartedRef.current = true;
    void fetch(`/api/beacon/${eventId}/start-broadcast`, {
      method: 'POST',
      headers: { 'x-ctf-csrf': '1' },
    }).catch((error) => {
      // Egress is additive — the screen-share itself still works. Report and move on; do not block UI.
      reportError(error, { area: 'beacon', op: 'start_broadcast_client', extra: { eventId } });
    });
  }, [isSharing, eventId]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => void screenShare.toggle()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 10,
          background: isMute ? `${t.ACCENT}20` : 'rgba(239,68,68,0.14)',
          border: `1px solid ${isMute ? `${t.ACCENT}55` : 'rgba(239,68,68,0.35)'}`,
          color: isMute ? t.ACCENT : '#F87171',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {isMute ? <ScreenShare size={18} /> : <ScreenShareOff size={18} />}
        {isMute ? 'Share screen' : 'Stop sharing'}
      </button>
      <span style={{ fontSize: 13, color: t.SUBTLE }}>
        {isSharing ? 'Your screen is live to the broadcast.' : 'Pick a screen or window to demo from this computer.'}
      </span>
    </div>
  );
}
