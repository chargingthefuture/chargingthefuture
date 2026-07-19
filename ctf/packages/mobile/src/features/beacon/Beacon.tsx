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
 *             the composer. Public watching always works signed-out. (BeaconLiveView)
 *   replay  → when nothing is live but the response carries the last replay's recording
 *             URL, that recording is playable. (BeaconIdleView)
 *   idle    → a calm "no live event right now" empty state. (BeaconIdleView)
 *
 * Watching is public (HLS needs no Stream token); chatting requires a signed-in member.
 * The chat token route (POST /api/beacon/[id]/chat-token) is the server-side member gate.
 *
 * This file owns the polling, chat-token lifecycle, and which state to show; the actual
 * markup for each state lives in BeaconLiveView / BeaconIdleView (and BeaconChatGate) so
 * no single function exceeds the modularity governance limits.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getBeaconChatCredentials,
  getBeaconCurrent,
  type BeaconChatCredentials,
  type BeaconCurrentResponse,
  type BeaconEventLike,
} from './BeaconApi';
import { BeaconLiveView } from './BeaconLiveView';
import { BeaconIdleView } from './BeaconIdleView';
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
        Live broadcasts from Farah. Watch with just the app; sign in to chat and react.
      </Text>

      {loading ? (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : liveEvent ? (
        <BeaconLiveView
          tokens={tokens}
          accent={accent}
          liveEvent={liveEvent}
          hlsUrl={hlsUrl}
          isAuthenticated={isAuthenticated}
          chat={chat}
          chatError={chatError}
          onSignIn={() => void signIn()}
        />
      ) : (
        <BeaconIdleView tokens={tokens} replay={replay} />
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
  });
}
