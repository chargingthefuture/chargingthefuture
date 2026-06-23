/**
 * BeaconLiveView — the "live" state of the Beacon viewer.
 *
 * Renders the live badge, the event title/description, the HLS player (or a
 * "starting…" frame while the playlist URL is not yet present), the public-notice
 * fineprint, and the live chat panel. The chat panel delegates the member-vs-anonymous
 * branch to BeaconChatGate.
 *
 * This is a decomposition of the markup that previously lived inline in Beacon.tsx;
 * the rendered output and behavior are identical.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type ThemeTokens } from '../../theme';
import { type BeaconChatCredentials, type BeaconEventLike } from './BeaconApi';
import { BeaconChatGate } from './BeaconChatGate';
import { BeaconVideo } from './BeaconVideo';

export interface BeaconLiveViewProps {
  tokens: ThemeTokens;
  accent: string;
  liveEvent: BeaconEventLike;
  hlsUrl: string | null;
  isAuthenticated: boolean;
  chat: BeaconChatCredentials | null;
  chatError: string | null;
  onSignIn: () => void;
}

export const BeaconLiveView: React.FC<BeaconLiveViewProps> = ({
  tokens,
  accent,
  liveEvent,
  hlsUrl,
  isAuthenticated,
  chat,
  chatError,
  onSignIn,
}) => {
  const styles = React.useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={styles.liveBlock}>
      <View style={[styles.liveBadge, { borderColor: accent, backgroundColor: accent + '22' }]}>
        <View style={[styles.liveDot, { backgroundColor: accent }]} />
        <Text style={[styles.liveBadgeText, { color: accent }]}>LIVE AND PUBLIC</Text>
      </View>

      <Text style={[styles.eventTitle, { color: tokens.textPrimary }]}>{liveEvent.title}</Text>
      {liveEvent.description ? (
        <Text style={[styles.eventDesc, { color: tokens.textSecondary }]}>
          {liveEvent.description}
        </Text>
      ) : null}

      {hlsUrl ? (
        <BeaconVideo source={hlsUrl} autoPlay muted />
      ) : (
        <View style={styles.startingFrame}>
          <Text style={[styles.startingText, { color: tokens.textSecondary }]}>
            The broadcast is starting…
          </Text>
        </View>
      )}

      <Text style={[styles.fineprint, { color: tokens.textMuted }]}>
        This broadcast and its chat are public. The event is recorded; the replay is posted to
        the Commons.
      </Text>

      <View style={[styles.chatPanel, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
        <View style={[styles.chatHeader, { borderBottomColor: tokens.border }]}>
          <Text style={[styles.chatHeaderText, { color: tokens.textPrimary }]}>Live chat</Text>
        </View>
        <BeaconChatGate
          tokens={tokens}
          accent={accent}
          isAuthenticated={isAuthenticated}
          chat={chat}
          chatError={chatError}
          onSignIn={onSignIn}
        />
      </View>
    </View>
  );
};

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    liveBlock: { gap: 10 },
    liveBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: t.isComic ? t.radiusChip : 999,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    liveDot: { width: 8, height: 8, borderRadius: 4 },
    liveBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    eventTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
    eventDesc: { fontSize: 14, marginBottom: 2 },
    startingFrame: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startingText: { fontSize: 14 },
    fineprint: { fontSize: 12, marginTop: 2 },
    chatPanel: {
      marginTop: 8,
      borderWidth: 1,
      borderRadius: t.radius,
      overflow: 'hidden',
    },
    chatHeader: { padding: 12, borderBottomWidth: 1 },
    chatHeaderText: { fontSize: 14, fontWeight: '700' },
  });
}
