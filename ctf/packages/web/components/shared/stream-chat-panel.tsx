import React, { useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Thread,
  Window,
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import './stream-chat-panel.css';

// The logged-in author's own messages are always gray; everyone else's use the plugin accent.
const OWN_BUBBLE_BG = 'rgba(255, 255, 255, 0.07)';

// Pick a readable text color (near-black or white) for text sitting on the accent bubble, by the
// accent's luminance — so a light accent (e.g. amber) gets dark text and a saturated one gets white.
function readableTextOn(color: string): string {
  const hex = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#FFFFFF';
}

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
  const themeVars = {
    // Own messages are gray everywhere; other people's messages take the plugin accent (below).
    '--ctf-chat-own-bg': OWN_BUBBLE_BG,
    ...(accentColor
      ? {
          '--str-chat__primary-color': accentColor,
          '--str-chat__active-primary-color': accentColor,
          '--str-chat__message-send-color': accentColor,
          '--ctf-chat-other-bg': accentColor,
          '--ctf-chat-other-fg': readableTextOn(accentColor),
        }
      : {}),
  } as React.CSSProperties;

  return (
    <div className="str-chat__theme-dark" style={{ height: '100%', display: 'flex', flexDirection: 'column', ...themeVars }}>
      <Chat client={client}>
        <Channel channel={channel}>
          {/* Window holds the main conversation; it yields to the Thread panel when a reply thread is
              open (the thread slides over on phone-width, sits beside on desktop). Wrapping the list +
              input in Window — and rendering a sibling Thread — is what turns on Stream's threaded
              replies. Reactions, the typing indicator, and read state come with the v12 MessageList
              defaults once the channel type allows them (the messaging type does). */}
          <Window>
            <MessageList />
            <MessageInput />
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};
