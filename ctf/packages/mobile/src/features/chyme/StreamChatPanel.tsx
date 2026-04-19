import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StreamChat } from 'stream-chat';
import { Chat, Channel, MessageList, MessageInput } from 'stream-chat-react-native';

export interface StreamChatPanelProps {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
  channelType?: string;
}

export const StreamChatPanel: React.FC<StreamChatPanelProps> = ({
  streamApiKey,
  streamToken,
  streamUserId,
  streamChannelId,
  channelType = 'messaging',
}) => {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const chatClient = StreamChat.getInstance(streamApiKey);
    chatClient
      .connectUser({ id: streamUserId }, streamToken)
      .then(() => {
        const ch = chatClient.channel(channelType, streamChannelId);
        setChannel(ch);
        setClient(chatClient);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to connect to chat.');
        setLoading(false);
      });
    return () => {
      chatClient.disconnectUser();
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId, channelType]);

  if (loading) return <ActivityIndicator size="large" />;
  if (error) return <Text>{error}</Text>;
  if (!client || !channel) return <Text>Chat unavailable.</Text>;

  return (
    <View style={{ height: 300 }}>
      <Chat client={client}>
        <Channel channel={channel}>
          <MessageList />
          <MessageInput />
        </Channel>
      </Chat>
    </View>
  );
};
