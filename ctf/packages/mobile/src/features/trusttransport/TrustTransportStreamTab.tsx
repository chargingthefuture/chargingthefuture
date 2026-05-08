import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { fetchTrustTransportStreamCredentials } from './fetchTrustTransportStreamCredentials';
import { StreamChat } from 'stream-chat';
import { OverlayProvider, Chat, Channel, MessageList, MessageInput } from 'stream-chat-react-native';
import { StreamVideo, StreamVideoClient, Call, StreamCall, CallContent } from '@stream-io/video-react-native-sdk';

interface TrustTransportStreamTabProps {
  tripId: string;
}

export const TrustTransportStreamTab: React.FC<TrustTransportStreamTabProps> = ({ tripId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<any>(null);
  const [chatClient, setChatClient] = useState<any>(null);
  const [videoClient, setVideoClient] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    fetchTrustTransportStreamCredentials(tripId)
      .then((creds) => {
        if (!isMounted) return;
        setCredentials(creds);
        const chat = StreamChat.getInstance(creds.apiKey);
        chat.connectUser({ id: creds.userId }, creds.userToken);
        setChatClient(chat);
        const video = new StreamVideoClient({ apiKey: creds.apiKey, user: { id: creds.userId }, token: creds.userToken });
        setVideoClient(video);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => { isMounted = false; chatClient?.disconnectUser(); videoClient?.disconnect(); };
  }, [tripId]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#F97316" /></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: 'red' }}>{error}</Text></View>;
  if (!credentials || !chatClient || !videoClient) return null;

  return (
    <OverlayProvider>
      <StreamVideo client={videoClient}>
        <StreamCall call={videoClient.call(credentials.callId)}>
          <CallContent />
        </StreamCall>
      </StreamVideo>
      <Chat client={chatClient}>
        <Channel channel={chatClient.channel('messaging', credentials.chatChannelId)}>
          <MessageList />
          <MessageInput />
        </Channel>
      </Chat>
    </OverlayProvider>
  );
};
