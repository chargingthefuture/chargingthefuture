import React, { useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
} from 'stream-chat-react-native';
import { View, ActivityIndicator, Text } from 'react-native';

export interface StreamChatViewProps {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
  channelType?: string;
}

export const StreamChatView: React.FC<StreamChatViewProps> = ({
  streamApiKey,
  streamToken,
  streamUserId,
  streamChannelId,
  channelType = 'messaging',
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [client, setClient] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [channel, setChannel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const chatClient = StreamChat.getInstance(streamApiKey);
    let isMounted = true;
    chatClient
      .connectUser({ id: streamUserId }, streamToken)
      .then(() => {
        const ch = chatClient.channel(channelType, streamChannelId);
        return ch.watch().then(() => {
          if (!isMounted) return;
          setChannel(ch);
          setClient(chatClient);
          setLoading(false);
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Failed to connect to chat.');
        setLoading(false);
      });
    return () => {
      isMounted = false;
      // Only disconnect if this component established the connection
      if (chatClient.user?.id === streamUserId) {
        chatClient.disconnectUser();
      }
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId, channelType]);

  if (loading) return <ActivityIndicator size="large" />;
  if (error) return <Text>{error}</Text>;
  if (!client || !channel) return <Text>Chat unavailable.</Text>;

  return (
    <View style={{ flex: 1 }}>
      <Chat client={client}>
        <Channel channel={channel}>
          <MessageList />
          <MessageInput />
        </Channel>
      </Chat>
    </View>
  );
};
