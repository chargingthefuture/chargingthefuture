import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { fetchQuestionsStreamCredentials } from './fetchQuestionsStreamCredentials';
import { StreamChat } from 'stream-chat';
import { OverlayProvider, Chat, Channel, MessageList, MessageInput } from 'stream-chat-react-native';
import { useTheme } from '../../theme';

export const Questions = () => {
  const { tokens } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [credentials, setCredentials] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chatClient, setChatClient] = useState<any>(null);
  // Hold the connected client in a ref so the effect cleanup always sees the current value.
  // A cleanup closure over the `chatClient` state would capture the initial `null` and never
  // tear the connection down.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chatClientRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const connect = async () => {
      try {
        const creds = await fetchQuestionsStreamCredentials();
        if (!isMounted) return;
        const chat = StreamChat.getInstance(creds.apiKey);
        // Await the WebSocket handshake before rendering the channel — the Chat/Channel components
        // must not watch a channel before the user is connected, or the Stream SDK can throw or
        // silently fail. If the component unmounted while connecting, tear the client back down.
        await chat.connectUser({ id: creds.userId }, creds.userToken);
        if (!isMounted) {
          await chat.disconnectUser();
          return;
        }
        chatClientRef.current = chat;
        setCredentials(creds);
        setChatClient(chat);
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Unable to load Questions chat.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void connect();

    return () => {
      isMounted = false;
      chatClientRef.current?.disconnectUser();
      chatClientRef.current = null;
    };
  }, []);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={tokens.textSecondary} /></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: tokens.danger }}>{error}</Text></View>;
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
