import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StreamVideoClient, StreamCall, StreamVideoParticipantView } from '@stream-io/video-react-native-sdk';

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

  if (loading) return <ActivityIndicator size="large" />;
  if (error) return <Text>{error}</Text>;
  if (!client || !call) return <Text>Video unavailable.</Text>;

  // Placeholder: Replace with Stream Video UI components as needed
  return (
    <View style={{ marginVertical: 16 }}>
      <Text>Video Room: {streamChannelId}</Text>
      <StreamVideoParticipantView call={call} />
    </View>
  );
};
