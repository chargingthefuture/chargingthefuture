'use client';

// The Beacon host's in-browser publisher: camera and microphone (a phone works) or a shared screen,
// published into the same livestream call as the host. The controls are in beacon-host-controls.tsx.
// The other input path is a broadcaster app pushing to the RTMP address shown in the admin shell.
//
// The client and call are made on mount, but the call is joined only when the host presses Use
// camera and microphone or Share screen. Joining on mount put a silent participant in the call,
// which Stream took as the broadcaster: the feed and recording started on nothing.
import { useEffect, useState } from 'react';
import { StreamVideo, StreamVideoClient, StreamCall, type Call } from '@stream-io/video-react-sdk';
import { BeaconHostControls } from './beacon-host-controls';

export type BeaconHostCredentials = {
  streamApiKey: string;
  streamCallType: string;
  streamCallId: string;
  streamUserId: string;
  hostToken: string;
  displayName: string;
};

export function BeaconHostStage({ credentials, eventId }: { credentials: BeaconHostCredentials; eventId: string }) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: credentials.displayName },
      token: credentials.hostToken,
    });
    const hostCall = videoClient.call(credentials.streamCallType, credentials.streamCallId);
    setClient(videoClient);
    setCall(hostCall);

    return () => {
      setClient(null);
      setCall(null);
      void (async () => {
        try { await hostCall.leave(); } catch { /* no-trace: cleanup on unmount; the call may never have been joined */ }
        try { await videoClient.disconnectUser(); } catch { /* no-trace: cleanup on unmount; releases the client only */ }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamCallType, credentials.streamCallId, credentials.streamUserId, credentials.hostToken, credentials.displayName]);

  if (!client || !call) {
    return null;
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <BeaconHostControls call={call} eventId={eventId} />
      </StreamCall>
    </StreamVideo>
  );
}
