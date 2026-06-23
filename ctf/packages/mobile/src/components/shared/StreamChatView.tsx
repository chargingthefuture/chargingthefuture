import React, { useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  ThemeProvider,
  type DeepPartial,
  type Theme,
} from 'stream-chat-react-native';
import { View, ActivityIndicator, Text } from 'react-native';

export interface StreamChatViewProps {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
  channelType?: string;
  // The plugin's accent color for other people's message bubbles. The logged-in member's own
  // messages stay gray (the web bubble-color convention). Defaults to the chyme sky accent.
  accentColor?: string;
}

// The logged-in member's own messages render gray; everyone else's use the plugin accent.
const OWN_BUBBLE_BG = 'rgba(255,255,255,0.06)';
const OWN_BUBBLE_BORDER = 'rgba(255,255,255,0.12)';

export const StreamChatView: React.FC<StreamChatViewProps> = ({
  streamApiKey,
  streamToken,
  streamUserId,
  streamChannelId,
  channelType = 'messaging',
  accentColor = '#0EA5E9',
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

  // Others' bubbles take the plugin accent (base theme); own messages override back to gray.
  const othersTheme: DeepPartial<Theme> = {
    messageSimple: { content: { containerInner: { backgroundColor: accentColor, borderColor: accentColor } } },
  };
  const myMessageTheme: DeepPartial<Theme> = {
    messageSimple: {
      content: { containerInner: { backgroundColor: OWN_BUBBLE_BG, borderColor: OWN_BUBBLE_BORDER } },
    },
  };

  return (
    <View style={{ flex: 1 }}>
      <Chat client={client}>
        <ThemeProvider style={othersTheme}>
          <Channel channel={channel} myMessageTheme={myMessageTheme}>
            <MessageList />
            <MessageInput />
          </Channel>
        </ThemeProvider>
      </Chat>
    </View>
  );
};
