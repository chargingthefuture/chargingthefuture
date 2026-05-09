'use client';

import React, { useEffect, useState } from 'react';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  SpeakerLayout,
  CallControls,
  StreamTheme,
  Call,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';

export interface StreamVideoPanelProps {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
  callType?: 'default' | 'audio_room';
}

export const StreamVideoPanel: React.FC<StreamVideoPanelProps> = ({
  streamApiKey,
  streamToken,
  streamUserId,
  streamChannelId,
  callType = 'default',
}) => {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClient(null);
    setCall(null);
    setLoading(true);
    setError(null);
    let cancelled = false;

    const videoClient = new StreamVideoClient({
      apiKey: streamApiKey,
      user: { id: streamUserId },
      token: streamToken,
    });
    const c = videoClient.call(callType, streamChannelId);
    c.join({ create: true })
      .then(() => {
        if (cancelled) return;
        setClient(videoClient);
        setCall(c);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Failed to join video room.');
        setLoading(false);
        videoClient.disconnectUser().catch(() => {});
      });
    return () => {
      cancelled = true;
      c.leave().catch(() => {});
      videoClient.disconnectUser().catch(() => {});
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId, callType]);

  if (loading) return <div className="p-4 text-sm">Connecting to room…</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;
  if (!client || !call) return <div className="p-4 text-sm">Room unavailable.</div>;

  return (
    <StreamTheme>
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <SpeakerLayout />
          <CallControls />
        </StreamCall>
      </StreamVideo>
    </StreamTheme>
  );
};
