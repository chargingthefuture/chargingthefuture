/**
 * BeaconHostStage — the host's publisher inside the Android app.
 *
 * Makes a Stream Video client and the event's livestream call with the host credentials from
 * GET /api/beacon/[id]/ingest, but joins the call only when the host presses a button in
 * BeaconHostControls. Joining with nothing turned on put a silent participant in the call, which
 * Stream took as the broadcaster: the feed and recording started and recorded nothing (owner
 * report, 2026-10-06, on the web admin page).
 *
 * Unmounting leaves the call and disconnects the client, so switching away from Beacon or signing
 * out stops publishing.
 */
import React, { useEffect, useState } from 'react';
import { StreamCall, StreamVideo, StreamVideoClient, type Call } from '@stream-io/video-react-native-sdk';
import { type BeaconHostCredentials } from './BeaconApi';
import { BeaconHostControls } from './BeaconHostControls';
import { type BeaconTokens } from './BeaconTheme';

export interface BeaconHostStageProps {
  credentials: BeaconHostCredentials;
  eventId: string;
  displayName: string;
  t: BeaconTokens;
}

export const BeaconHostStage: React.FC<BeaconHostStageProps> = ({ credentials, eventId, displayName, t }) => {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    const videoClient = new StreamVideoClient({
      apiKey: credentials.streamApiKey,
      user: { id: credentials.streamUserId, name: displayName },
      token: credentials.hostToken,
    });
    const hostCall = videoClient.call(credentials.streamCallType, credentials.streamCallId);
    setClient(videoClient);
    setCall(hostCall);

    return () => {
      setClient(null);
      setCall(null);
      void (async () => {
        try {
          await hostCall.leave();
        } catch {
          // no-trace: cleanup on unmount; the call may never have been joined
        }
        try {
          await videoClient.disconnectUser();
        } catch {
          // no-trace: cleanup on unmount; releases the client only
        }
      })();
    };
  }, [credentials.streamApiKey, credentials.streamCallType, credentials.streamCallId, credentials.streamUserId, credentials.hostToken, displayName]);

  if (!client || !call) {
    return null;
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <BeaconHostControls call={call} eventId={eventId} t={t} />
      </StreamCall>
    </StreamVideo>
  );
};
