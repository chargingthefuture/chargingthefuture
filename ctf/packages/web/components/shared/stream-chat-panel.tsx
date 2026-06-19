import React, { useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';

export interface StreamChatPanelProps {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
  channelType?: string;
  /** Plugin brand color used to tint Stream's accent (send button, links, active states). */
  accentColor?: string;
}

export const StreamChatPanel: React.FC<StreamChatPanelProps> = ({
  streamApiKey,
  streamToken,
  streamUserId,
  streamChannelId,
  channelType = 'messaging',
  accentColor,
}) => {
  const [client, setClient] = useState<StreamChat | null>(null);
  // The Stream Channel type is generically parameterized and impractical to satisfy here; the value is
  // only passed straight to <Channel channel={channel}>. TODO: type once stream-chat generics are pinned.
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
      chatClient.disconnectUser();
    };
  }, [streamApiKey, streamToken, streamUserId, streamChannelId, channelType]);

  if (loading) return <div style={{ padding: 16, color: '#9CA3AF', fontSize: 14 }}>Loading chat…</div>;
  if (error) return <div style={{ padding: 16, color: '#EF4444', fontSize: 14 }}>{error}</div>;
  if (!client || !channel) return <div style={{ padding: 16, color: '#9CA3AF', fontSize: 14 }}>Chat unavailable.</div>;

  // The whole app is dark, so the chat must use Stream's dark theme (it used to render the light
  // theme, which looked like a white widget dropped into a dark plugin). The wrapper carries the
  // theme class and, when given, tints Stream's accent CSS variables to the plugin's brand color.
  const themeVars = accentColor
    ? ({
        '--str-chat__primary-color': accentColor,
        '--str-chat__active-primary-color': accentColor,
        '--str-chat__message-send-color': accentColor,
      } as React.CSSProperties)
    : {};

  return (
    <div className="str-chat__theme-dark" style={{ height: '100%', display: 'flex', flexDirection: 'column', ...themeVars }}>
      <Chat client={client}>
        <Channel channel={channel}>
          <MessageList />
          <MessageInput />
        </Channel>
      </Chat>
    </div>
  );
};
