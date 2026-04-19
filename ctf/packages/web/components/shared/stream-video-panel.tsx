import React, { useEffect, useState } from 'react';
import { StreamVideoClient, StreamCall } from '@stream-io/video-react-sdk';

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
  const [call, setCall] = useState<StreamCall | null>(null);
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
      c.leave();
      videoClient.disconnectUser();
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId]);

  if (loading) return <div>Loading video…</div>;
  if (error) return <div>{error}</div>;
  if (!client || !call) return <div>Video unavailable.</div>;

  // Placeholder: Replace with Stream Video UI components as needed
  return (
    <div>
      <h3>Video Room: {streamChannelId}</h3>
      {/* Stream Video UI goes here */}
    </div>
  );
};
