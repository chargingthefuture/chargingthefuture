import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { fetchSurvivorHubChatStreamCredentials } from './fetchSurvivorHubChatStreamCredentials';
import { StreamChat } from 'stream-chat';
import { OverlayProvider, Chat, Channel, MessageList, MessageInput } from 'stream-chat-react-native';

export const SurvivorHubChat = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<any>(null);
  const [chatClient, setChatClient] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    fetchSurvivorHubChatStreamCredentials()
      .then((creds) => {
        if (!isMounted) return;
        setCredentials(creds);
        const chat = StreamChat.getInstance(creds.apiKey);
        chat.connectUser({ id: creds.userId }, creds.userToken);
        setChatClient(chat);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => { isMounted = false; chatClient?.disconnectUser(); };
  }, []);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#F97316" /></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: 'red' }}>{error}</Text></View>;
  if (!credentials || !chatClient) return null;

  return (
    <OverlayProvider>
      <Chat client={chatClient}>
        <Channel channel={chatClient.channel('messaging', credentials.chatChannelId)}>
          <MessageList />
          <MessageInput />
        </Channel>
      </Chat>
    </OverlayProvider>
  );
};
