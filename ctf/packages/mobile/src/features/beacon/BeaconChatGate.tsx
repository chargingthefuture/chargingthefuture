/**
 * BeaconChatGate — the body of the Beacon live chat panel, copied from the chat side of the web
 * BeaconLiveView (components/beacon/beacon-viewer.tsx).
 *
 * Watching a Beacon broadcast is public, but chatting requires a signed-in member (the server-side
 * chat-token route is the real gate):
 *   - signed in + credentials ready → the shared StreamChatView (threads/reactions)
 *   - signed in, credentials pending → "Connecting to chat…" (or the error)
 *   - signed out → the lock, a "sign in to chat" line and a sign-in button
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { StreamChatView } from '../../components/shared/StreamChatView';
import { type BeaconChatCredentials } from './BeaconApi';
import { centeredStyle, centeredText, ctaStyle, ctaText, type BeaconTokens } from './BeaconTheme';

export interface BeaconChatGateProps {
  t: BeaconTokens;
  isAuthenticated: boolean;
  chat: BeaconChatCredentials | null;
  chatError: string | null;
  onSignIn: () => void;
}

export const BeaconChatGate: React.FC<BeaconChatGateProps> = ({ t, isAuthenticated, chat, chatError, onSignIn }) => {
  if (isAuthenticated && chat) {
    return (
      <View style={styles.chatBody}>
        <StreamChatView
          streamApiKey={chat.streamApiKey}
          streamToken={chat.streamToken}
          streamUserId={chat.streamUserId}
          streamChannelId={chat.streamChannelId}
          channelType={chat.streamChannelType}
          accentColor={t.ACCENT}
        />
      </View>
    );
  }
  if (isAuthenticated) {
    return (
      <View style={[centeredStyle(t), styles.fill]}>
        <Text style={centeredText(t)}>{chatError ?? 'Connecting to chat…'}</Text>
      </View>
    );
  }
  return (
    <View style={[centeredStyle(t), styles.fill, styles.signedOut]}>
      <Lock size={28} color={t.SUBTLE} />
      <Text style={centeredText(t)}>Sign in to chat and react. Anyone can watch — chatting is for members.</Text>
      <TouchableOpacity
        style={[ctaStyle(t, 18, 9), styles.signIn]}
        onPress={onSignIn}
        accessibilityRole="button"
        accessibilityLabel="Sign in to chat"
      >
        <Text style={ctaText(t)}>Sign in to chat</Text>
      </TouchableOpacity>
    </View>
  );
};

// The web aside is at least 420px tall and its header row takes about 45px of it.
const styles = StyleSheet.create({
  chatBody: { height: 375 },
  fill: { flex: 1 },
  signedOut: { gap: 12, padding: 24 },
  signIn: { alignSelf: 'center' },
});
