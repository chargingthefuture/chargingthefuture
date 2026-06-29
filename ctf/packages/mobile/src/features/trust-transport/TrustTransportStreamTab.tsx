import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { fetchTrustTransportStreamCredentials } from './fetchTrustTransportStreamCredentials';
import { StreamChat } from 'stream-chat';
import { OverlayProvider, Chat, Channel, MessageList, MessageInput } from 'stream-chat-react-native';

interface TrustTransportStreamTabProps {
  tripId: string;
}

// Text chat for a trip thread. TrustTransport is chat only — there is deliberately no video room (the
// transport plugin does not do video, and the web has no video either).
export const TrustTransportStreamTab: React.FC<TrustTransportStreamTabProps> = ({ tripId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // `stream-chat` and `stream-chat-react-native` bundle divergent StreamChat type definitions:
  // StreamChat.getInstance() returns StreamChat<DefaultGenerics>, but the <Chat>/<Channel> props want the
  // RN package's generic-less StreamChat, so neither single type satisfies both ends (TS2740). Hold the
  // client loosely and let the JSX below consume it; the runtime object is the same StreamChat instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chatClient, setChatClient] = useState<any>(null);
  const [channelId, setChannelId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let chat: StreamChat | null = null;

    fetchTrustTransportStreamCredentials(tripId)
      .then(async (creds) => {
        if (!isMounted) return;
        chat = StreamChat.getInstance(creds.apiKey);
        await chat.connectUser({ id: creds.userId }, creds.userToken);
        if (!isMounted) return;
        setChatClient(chat);
        setChannelId(creds.chatChannelId);
      })
      .catch((e) => { if (isMounted) setError(e.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => {
      isMounted = false;
      (async () => {
        try { await chat?.disconnectUser(); } catch { /* already disconnected */ }
      })();
    };
  }, [tripId]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#F97316" /></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: 'red' }}>{error}</Text></View>;
  if (!chatClient || !channelId) return null;

  return (
    <OverlayProvider>
      <Chat client={chatClient}>
        <Channel channel={chatClient.channel('messaging', channelId)}>
          <MessageList />
          <MessageInput />
        </Channel>
      </Chat>
    </OverlayProvider>
  );
};
