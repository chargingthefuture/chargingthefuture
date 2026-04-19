import React, { useEffect, useState } from 'react';
import { StreamVideoClient, Call } from '@stream-io/video-react-sdk';

export interface StreamVideoPanelProps {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
}

export const StreamVideoPanel: React.FC<StreamVideoPanelProps> = ({
  streamApiKey,
  streamToken,
  streamUserId,
  streamChannelId,
}) => {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const videoClient = new StreamVideoClient({
      apiKey: streamApiKey,
      user: { id: streamUserId },
      token: streamToken,
    });
    setClient(videoClient);
    const c = videoClient.call('default', streamChannelId);
    c.join().then(() => {
      setCall(c);
      setLoading(false);
    }).catch((err) => {
      setError('Failed to join video room.');
      setLoading(false);
    });
    return () => {
      (async () => {
        try {
          await c.leave();
        } catch {}
        try {
          await videoClient.disconnectUser();
        } catch {}
      })();
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId]);

  if (loading) return <div>Loading video…</div>;
  if (error) return <div>{error}</div>;
  if (!client || !call) return <div>Video unavailable.</div>;

  // FIXME(StreamVideoPanel): Placeholder render for video UI. See tracking issue #1234.
  // TODO(StreamVideoPanel): Implement full video experience using StreamClientProvider, VideoRoom, ParticipantList, LocalVideo, RemoteVideo, etc. with streamChannelId={streamChannelId}
  // Tracking: https://github.com/chargingthefuture/ctf/issues/1234
  // This marker is intentional and scheduled for implementation.
  return (
    <div>
      <h3>Video Room: {streamChannelId}</h3>
      {/* Stubbed component hierarchy for reviewers: */}
      {/* <StreamClientProvider client={client}> */}
      {/*   <VideoRoom call={call}> */}
      {/*     <ParticipantList call={call} /> */}
      {/*     <LocalVideo call={call} /> */}
      {/*     <RemoteVideo call={call} /> */}
      {/*   </VideoRoom> */}
      {/* </StreamClientProvider> */}
      <div style={{ color: '#888', fontStyle: 'italic' }}>
        [Stream video UI coming soon for channel: {streamChannelId}]
      </div>
    </div>
  );
};
