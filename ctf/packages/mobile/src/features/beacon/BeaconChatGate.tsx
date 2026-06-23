/**
 * BeaconChatGate — the body of the Beacon live chat panel.
 *
 * Watching a Beacon broadcast is public, but chatting requires a signed-in member
 * (the server-side chat-token route is the real gate). This component renders the
 * member-vs-anonymous branch exactly as the viewer did inline:
 *   - signed in + credentials ready → the reused StreamChatView (threads/reactions)
 *   - signed in, credentials pending → a "Connecting to chat…" (or error) message
 *   - anonymous → a "sign in to chat" prompt with a sign-in button
 *
 * Behavior is identical to the previous inline markup; this is a decomposition only.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StreamChatView } from '../../components/shared/StreamChatView';
import { type ThemeTokens } from '../../theme';
import { type BeaconChatCredentials } from './BeaconApi';

export interface BeaconChatGateProps {
  tokens: ThemeTokens;
  accent: string;
  isAuthenticated: boolean;
  chat: BeaconChatCredentials | null;
  chatError: string | null;
  onSignIn: () => void;
}

export const BeaconChatGate: React.FC<BeaconChatGateProps> = ({
  tokens,
  accent,
  isAuthenticated,
  chat,
  chatError,
  onSignIn,
}) => {
  if (isAuthenticated) {
    if (chat) {
      return (
        <View style={styles.chatBody}>
          <StreamChatView
            streamApiKey={chat.streamApiKey}
            streamToken={chat.streamToken}
            streamUserId={chat.streamUserId}
            streamChannelId={chat.streamChannelId}
            channelType={chat.streamChannelType}
            accentColor={accent}
          />
        </View>
      );
    }
    return (
      <View style={styles.chatCenter}>
        <Text style={[styles.chatCenterText, { color: tokens.textSecondary }]}>
          {chatError ?? 'Connecting to chat…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.chatCenter}>
      <Text style={[styles.signInLead, { color: tokens.textSecondary }]}>
        Sign in to chat and react. Anyone can watch — chatting is for members.
      </Text>
      <TouchableOpacity
        style={[
          styles.signInBtn,
          { borderRadius: tokens.radius, borderColor: accent, backgroundColor: accent + '20' },
        ]}
        onPress={onSignIn}
        accessibilityRole="button"
        accessibilityLabel="Sign in to chat"
      >
        <Text style={[styles.signInBtnText, { color: accent }]}>Sign in to chat</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  chatBody: { height: 360 },
  chatCenter: { padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  chatCenterText: { fontSize: 14, textAlign: 'center' },
  signInLead: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  signInBtn: {
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  signInBtnText: { fontSize: 14, fontWeight: '700' },
});
