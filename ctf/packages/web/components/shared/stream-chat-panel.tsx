import React, { useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/index.css';

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
      .catch((err) => {
        if (!isMounted) return;
        setError('Failed to connect to chat.');
        setLoading(false);
      });
    return () => {
      isMounted = false;
      chatClient.disconnectUser();
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId, channelType]);

  if (loading) return <div>Loading chat…</div>;
  if (error) return <div>{error}</div>;
  if (!client || !channel) return <div>Chat unavailable.</div>;

  return (
    <Chat client={client} theme="messaging light">
      <Channel channel={channel}>
        <MessageList />
        <MessageInput />
      </Channel>
    </Chat>
  );
};
