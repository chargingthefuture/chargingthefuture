import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  CallContent,
  Call,
} from '@stream-io/video-react-native-sdk';

export interface StreamVideoPanelProps {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
  callType?: string;
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
    const videoClient = new StreamVideoClient({
      apiKey: streamApiKey,
      user: { id: streamUserId },
      token: streamToken,
    });
    const c = videoClient.call(callType, streamChannelId);
    c.join({ create: true })
      .then(() => {
        setClient(videoClient);
        setCall(c);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to join video room.');
        setLoading(false);
        videoClient.disconnectUser().catch(() => {});
      });
    return () => {
      c.leave().catch(() => {});
      videoClient.disconnectUser().catch(() => {});
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId, callType]);

  if (loading) return <ActivityIndicator size="large" />;
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!client || !call) return <Text>Video unavailable.</Text>;

  return (
    <View style={styles.container}>
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <CallContent />
        </StreamCall>
      </StreamVideo>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  error: { color: 'red', padding: 16 },
});
