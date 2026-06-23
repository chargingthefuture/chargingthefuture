import React, { useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';
import {
  OverlayProvider,
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Thread,
  type DeepPartial,
  type Theme,
  type ThreadContextValue,
} from 'stream-chat-react-native';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { StreamChatSearch } from './StreamChatSearch';

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

// The selected parent message when a reply thread is open. onThreadSelect hands back the thread
// context's `thread` value (the parent message), or null when there is no open thread.
type ThreadMessage = ThreadContextValue['thread'];

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
  const [thread, setThread] = useState<ThreadMessage>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const chatClient = StreamChat.getInstance(streamApiKey);
    let isMounted = true;
    chatClient
      .connectUser({ id: streamUserId }, streamToken)
      .then(() => {
        const ch = chatClient.channel(channelType, streamChannelId);
        // Watch with presence so the channel state carries its member list. The default '@' mention
        // trigger in MessageInput reads the channel members to suggest people, so members must be
        // loaded for the autocomplete list to offer anyone; watch({ presence: true }) populates
        // channel.state.members (matching the web panel).
        return ch.watch({ presence: true }).then(() => {
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

  // Others' bubbles take the plugin accent; the member's own messages override back to gray.
  // The accent theme is supplied through OverlayProvider's `value.style` — the SDK's global theme —
  // which replaces the previous ThemeProvider wrapper. Routing it through the OverlayProvider means
  // the long-press reaction overlay and the thread view inherit the same accent bubbles as the main
  // list. The member's own bubbles stay gray via the Channel-level `myMessageTheme`, which the SDK
  // layers on top of the global theme exactly as before.
  const othersTheme: DeepPartial<Theme> = {
    messageSimple: { content: { containerInner: { backgroundColor: accentColor, borderColor: accentColor } } },
  };
  const myMessageTheme: DeepPartial<Theme> = {
    messageSimple: {
      content: { containerInner: { backgroundColor: OWN_BUBBLE_BG, borderColor: OWN_BUBBLE_BORDER } },
    },
  };

  const threadOpen = Boolean(thread);

  return (
    <View style={{ flex: 1 }}>
      {/* OverlayProvider is required for the long-press reaction picker, the message-action menu, the
          thread view, and the @mention suggestion popup to render above the chat. Reactions need no
          extra prop: long-pressing a message shows the reaction picker by default once OverlayProvider
          wraps the channel and the channel type (messaging) permits reactions. @mention autocomplete
          is also a MessageInput default — typing '@' opens the member suggestion list (the SDK's
          built-in '@' trigger reads the watched channel's members; see watch({ presence: true })
          above), and that popup renders within this OverlayProvider. Link previews are automatic too:
          Stream enriches URLs server-side into og_scrape attachments, which the default MessageList
          Attachment renderer draws as preview Cards — no prop needed. Typing indicators and read state
          are the SDK's MessageList defaults. The accent bubble theme is passed here as the global
          style. */}
      <OverlayProvider value={{ style: othersTheme }}>
        <Chat client={client}>
          {/* thread + threadList tell the channel a reply thread is open so its list and input target
              that thread; myMessageTheme keeps the member's own bubbles gray over the accent theme. */}
          <Channel channel={channel} thread={thread} threadList={threadOpen} myMessageTheme={myMessageTheme}>
            {threadOpen ? (
              <View style={{ flex: 1 }}>
                {/* Back to the main conversation from an open thread. */}
                <Pressable
                  onPress={() => setThread(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Back to conversation"
                  style={{ paddingVertical: 12, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: accentColor, fontSize: 15, fontWeight: '600' }}>‹ Back</Text>
                </Pressable>
                <Thread />
              </View>
            ) : (
              <>
                {/* In-channel message search. stream-chat-react-native ships no drop-in search UI
                    (unlike the web SDK), so StreamChatSearch is a lightweight equivalent: it runs
                    channel.search(term) scoped to this channel on demand and lists the matches with
                    author + timestamp. It sits above the list so a member can search the conversation
                    they are reading. Search calls are user-initiated, not per-render. */}
                <StreamChatSearch channel={channel} accentColor={accentColor} />
                {/* onThreadSelect opens the reply thread for the tapped message; the SDK's "reply in
                    thread" message action hands the parent message back here to render <Thread />. */}
                <MessageList onThreadSelect={setThread} />
                <MessageInput />
              </>
            )}
          </Channel>
        </Chat>
      </OverlayProvider>
    </View>
  );
};
