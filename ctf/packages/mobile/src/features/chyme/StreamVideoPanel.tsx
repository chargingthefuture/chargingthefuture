import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StreamVideoClient, Call } from '@stream-io/video-react-native-sdk';
import { ParticipantView } from '@stream-io/video-react-native-sdk';

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
    }).catch(() => {
      setError('Failed to join video room.');
      setLoading(false);
    });
    return () => {
      (async () => {
        try {
          await c.leave();
        } catch {
          /* no-trace: the call was already left */
        }
        try {
          await videoClient.disconnectUser();
        } catch {
          /* no-trace: the client is already disconnected */
        }
      })();
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId]);

  if (loading) return <ActivityIndicator size="large" />;
  if (error) return <Text>{error}</Text>;
  if (!client || !call) return <Text>Video unavailable.</Text>;

  // Render the local participant if available, otherwise show unavailable
  const localParticipant = call?.state?.localParticipant;
  if (!localParticipant) return <Text>No participant available.</Text>;

  return (
    <View style={{ marginVertical: 16 }}>
      <Text>Video Room: {streamChannelId}</Text>
      <ParticipantView participant={localParticipant} />
    </View>
  );
};
