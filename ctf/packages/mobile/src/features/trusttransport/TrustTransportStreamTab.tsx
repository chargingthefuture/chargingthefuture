import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { fetchTrustTransportStreamCredentials } from './fetchTrustTransportStreamCredentials';
import { StreamChat } from 'stream-chat';
import { OverlayProvider, Chat, Channel, MessageList, MessageInput } from 'stream-chat-react-native';
import { StreamVideo, StreamVideoClient, StreamCall, CallContent, Call } from '@stream-io/video-react-native-sdk';

interface TrustTransportStreamTabProps {
  tripId: string;
}

export const TrustTransportStreamTab: React.FC<TrustTransportStreamTabProps> = ({ tripId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chatClient, setChatClient] = useState<any>(null);
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  // The joined video call. Stream Video needs a call type + id and an explicit join() before the room
  // renders — passing an unjoined call (or a call with no id) shows nothing.
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    let isMounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chat: any = null;
    let video: StreamVideoClient | null = null;
    let joinedCall: Call | null = null;

    fetchTrustTransportStreamCredentials(tripId)
      .then(async (creds) => {
        if (!isMounted) return;
        chat = StreamChat.getInstance(creds.apiKey);
        await chat.connectUser({ id: creds.userId }, creds.userToken);
        if (!isMounted) return;
        setChatClient(chat);
        setChannelId(creds.chatChannelId ?? null);

        video = new StreamVideoClient({ apiKey: creds.apiKey, user: { id: creds.userId }, token: creds.userToken });
        setVideoClient(video);
        if (creds.callId) {
          const c = video.call('default', creds.callId);
          await c.join({ create: true });
          if (!isMounted) return;
          joinedCall = c;
          setCall(c);
        }
      })
      .catch((e) => { if (isMounted) setError(e.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => {
      isMounted = false;
      (async () => {
        try { await joinedCall?.leave(); } catch { /* already left */ }
        try { await chat?.disconnectUser(); } catch { /* already disconnected */ }
        try { await video?.disconnectUser(); } catch { /* already disconnected */ }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#F97316" /></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: 'red' }}>{error}</Text></View>;
  if (!chatClient || !channelId) return null;

  return (
    <OverlayProvider>
      {videoClient && call ? (
        <StreamVideo client={videoClient}>
          <StreamCall call={call}>
            <CallContent />
          </StreamCall>
        </StreamVideo>
      ) : null}
      <Chat client={chatClient}>
        <Channel channel={chatClient.channel('messaging', channelId)}>
          <MessageList />
          <MessageInput />
        </Channel>
      </Chat>
    </OverlayProvider>
  );
};
