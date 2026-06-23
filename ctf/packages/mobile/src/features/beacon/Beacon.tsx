/**
 * Beacon — Android viewer for the Beacon plugin (admin one-way livestream).
 *
 * Parity with the web viewer (ctf/packages/web/components/beacon/beacon-viewer.tsx),
 * minus admin broadcasting. Admin broadcasting is intentionally out of scope on mobile:
 * the admin pushes the phone screen through a third-party RTMP app per the Beacon plan,
 * so this surface is viewer-only.
 *
 * It polls the public GET /api/beacon/current every 15 seconds (same cadence as web) and
 * renders one of three states:
 *   live    → HLS player + a clear "● Live · public" indicator. A signed-in member also
 *             gets the live chat (Stream Chat, reused StreamChatView with threads/
 *             reactions); an anonymous viewer sees a "sign in to chat" prompt instead of
 *             the composer. Public watching always works signed-out.
 *   replay  → when nothing is live but the response carries the last replay's recording
 *             URL, that recording is playable.
 *   idle    → a calm "no live event right now" empty state.
 *
 * Watching is public (HLS needs no Stream token); chatting requires a signed-in member.
 * The chat token route (POST /api/beacon/[id]/chat-token) is the server-side member gate.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getBeaconChatCredentials,
  getBeaconCurrent,
  type BeaconChatCredentials,
  type BeaconCurrentResponse,
  type BeaconEventLike,
} from './BeaconApi';
import { BeaconVideo } from './BeaconVideo';
import { StreamChatView } from '../../components/shared/StreamChatView';
import { useAuth } from '../../auth/auth-context';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

const POLL_INTERVAL_MS = 15000;

export const Beacon: React.FC = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('beacon', theme);
  const styles = React.useMemo(() => makeStyles(tokens), [tokens]);
  const { isAuthenticated, signIn } = useAuth();

  const [current, setCurrent] = useState<BeaconCurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<BeaconChatCredentials | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  // Guards against requesting two chat tokens for the same live event.
  const chatEventIdRef = useRef<string | null>(null);

  const loadCurrent = useCallback(async () => {
    try {
      const data = await getBeaconCurrent();
      setCurrent(data);
    } catch {
      // Network blip — keep the last known state and try again on the next poll, exactly
      // like the web viewer. The first failure (no prior state) falls through to idle.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrent();
    const timer = setInterval(() => void loadCurrent(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadCurrent]);

  const liveEvent: BeaconEventLike | null =
    current?.event && current.event.status === 'live' ? current.event : null;
  const hlsUrl = liveEvent ? current?.hlsPlaybackUrl ?? null : null;
  const replay = current?.replay ?? null;

  // A signed-in member opts into chat by requesting a token (the server-side member gate).
  const joinChat = useCallback(async (eventId: string) => {
    setChatError(null);
    try {
      const credentials = await getBeaconChatCredentials(eventId);
      if (!credentials) {
        setChatError('Live chat is unavailable right now.');
        return;
      }
      setChat(credentials);
    } catch {
      setChatError('Live chat is unavailable right now.');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && liveEvent && chatEventIdRef.current !== liveEvent.id) {
      chatEventIdRef.current = liveEvent.id;
      void joinChat(liveEvent.id);
    }
    // When the event ends (or there is no live event), drop the chat connection.
    if (!liveEvent && (chat || chatEventIdRef.current)) {
      chatEventIdRef.current = null;
      setChat(null);
      setChatError(null);
    }
  }, [isAuthenticated, liveEvent, chat, joinChat]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: tokens.bg }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: tokens.textPrimary }]}>Beacon</Text>
      <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
        Live broadcasts from the team. Watch with just the app; sign in to chat and react.
      </Text>

      {loading ? (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : liveEvent ? (
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
            {isAuthenticated ? (
              chat ? (
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
              ) : (
                <View style={styles.chatCenter}>
                  <Text style={[styles.chatCenterText, { color: tokens.textSecondary }]}>
                    {chatError ?? 'Connecting to chat…'}
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.chatCenter}>
                <Text style={[styles.signInLead, { color: tokens.textSecondary }]}>
                  Sign in to chat and react. Anyone can watch — chatting is for members.
                </Text>
                <TouchableOpacity
                  style={[styles.signInBtn, { borderColor: accent, backgroundColor: accent + '20' }]}
                  onPress={() => void signIn()}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in to chat"
                >
                  <Text style={[styles.signInBtnText, { color: accent }]}>Sign in to chat</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.idleCard}>
          <Text style={[styles.idleTitle, { color: tokens.textPrimary }]}>No live event right now</Text>
          <Text style={[styles.idleBody, { color: tokens.textSecondary }]}>
            When the team goes live, it will appear here.
          </Text>
          {replay?.recordingUrl ? (
            <View style={styles.replayBlock}>
              <Text style={[styles.replayLabel, { color: tokens.textSecondary }]}>Last replay</Text>
              <BeaconVideo source={replay.recordingUrl} autoPlay={false} muted={false} />
              <Text style={[styles.replayTitle, { color: tokens.textPrimary }]}>{replay.title}</Text>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
};

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    content: { padding: 16, paddingBottom: 32, gap: 4 },
    title: { fontSize: 22, fontWeight: '700' },
    subtitle: { fontSize: 13, marginBottom: 12 },
    centerCard: {
      marginTop: 16,
      padding: 32,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    chatBody: { height: 360 },
    chatCenter: { padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
    chatCenterText: { fontSize: 14, textAlign: 'center' },
    signInLead: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    signInBtn: {
      borderWidth: 1,
      borderRadius: t.radius,
      paddingVertical: 9,
      paddingHorizontal: 18,
    },
    signInBtnText: { fontSize: 14, fontWeight: '700' },
    idleCard: {
      marginTop: 16,
      padding: 24,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    idleTitle: { fontSize: 16, fontWeight: '700' },
    idleBody: { fontSize: 14, marginTop: 6, textAlign: 'center' },
    replayBlock: { marginTop: 20, alignSelf: 'stretch', gap: 8 },
    replayLabel: { fontSize: 13, fontWeight: '700' },
    replayTitle: { fontSize: 14, fontWeight: '600' },
  });
}
