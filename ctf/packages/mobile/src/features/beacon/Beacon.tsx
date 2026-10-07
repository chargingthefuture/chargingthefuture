/**
 * Beacon — the Beacon screen in the Android app: watch, chat, and (for an admin) go live.
 *
 * Owner decision, 2026-10-06: the Android app carries any plugin that materially benefits from being
 * an installed app. Beacon does, because an installed Android app can share the phone's screen and a
 * web page cannot (rule 105).
 *
 * It polls the public GET /api/beacon/current every 15 seconds (the same cadence as the web viewer)
 * and renders one of three states:
 *   live    → HLS player + a "LIVE AND PUBLIC" badge. A signed-in member also gets the live chat;
 *             a signed-out viewer sees a "sign in to chat" prompt instead. (BeaconLiveView)
 *   replay  → nothing live, but the response carries the last replay's recording. (BeaconIdleView)
 *   idle    → a calm "no live event right now" empty state. (BeaconIdleView)
 * An admin also sees BeaconHostPanel above it: go live with the camera and microphone, or share the
 * phone's screen.
 *
 * This file owns the polling, the chat-token lifecycle, and which state to show.
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
import { BeaconHostPanel } from './BeaconHostPanel';
import { BeaconLiveView } from './BeaconLiveView';
import { BeaconIdleView } from './BeaconIdleView';
import { useAuth } from '../../auth/auth-context';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

const POLL_INTERVAL_MS = 15000;

// Joins the event chat once per live event for a signed-in member and drops it when the event ends.
function useBeaconChat(isAuthenticated: boolean, liveEvent: BeaconEventLike | null) {
  const [chat, setChat] = useState<BeaconChatCredentials | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  // Guards against requesting two chat tokens for the same live event.
  const chatEventIdRef = useRef<string | null>(null);
  const liveEventId = liveEvent?.id ?? null;

  useEffect(() => {
    if (!liveEventId) {
      chatEventIdRef.current = null;
      setChat(null);
      setChatError(null);
      return;
    }
    if (!isAuthenticated || chatEventIdRef.current === liveEventId) {
      return;
    }
    chatEventIdRef.current = liveEventId;
    setChatError(null);
    void getBeaconChatCredentials(liveEventId).then((credentials) => {
      if (credentials) {
        setChat(credentials);
      } else {
        setChatError('Live chat is unavailable right now.');
      }
    });
  }, [isAuthenticated, liveEventId]);

  return { chat, chatError };
}

export const Beacon: React.FC = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('beacon', theme);
  const styles = React.useMemo(() => makeStyles(tokens), [tokens]);
  const { isAuthenticated, signIn, user } = useAuth();

  const [current, setCurrent] = useState<BeaconCurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCurrent = useCallback(async () => {
    try {
      setCurrent(await getBeaconCurrent());
    } catch {
      // Network blip: keep the last known state and try again on the next poll, like the web viewer.
      // The first failure (no prior state) falls through to idle.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrent();
    const timer = setInterval(() => void loadCurrent(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadCurrent]);

  const liveEvent = liveEventOf(current);
  const { chat, chatError } = useBeaconChat(isAuthenticated, liveEvent);

  return (
    <ScrollView style={[styles.root, { backgroundColor: tokens.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>Beacon</Text>
      <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
        Live broadcasts from Farah. Watch with just the app; sign in to chat and react.
      </Text>

      {user?.isAdmin ? (
        <BeaconHostPanel tokens={tokens} accent={accent} displayName={hostName(user.username)} onChanged={() => void loadCurrent()} />
      ) : null}

      <BeaconBody
        tokens={tokens}
        accent={accent}
        loading={loading}
        current={current}
        liveEvent={liveEvent}
        isAuthenticated={isAuthenticated}
        chat={chat}
        chatError={chatError}
        onSignIn={() => void signIn()}
      />
    </ScrollView>
  );
};

function liveEventOf(current: BeaconCurrentResponse | null): BeaconEventLike | null {
  return current?.event && current.event.status === 'live' ? current.event : null;
}

function hostName(username: string | null | undefined): string {
  return username ?? 'Beacon host';
}

// Loading, live or idle: which of the three viewer states to show.
function BeaconBody({ tokens, accent, loading, current, liveEvent, isAuthenticated, chat, chatError, onSignIn }: {
  tokens: ThemeTokens;
  accent: string;
  loading: boolean;
  current: BeaconCurrentResponse | null;
  liveEvent: BeaconEventLike | null;
  isAuthenticated: boolean;
  chat: BeaconChatCredentials | null;
  chatError: string | null;
  onSignIn: () => void;
}) {
  if (loading) {
    return (
      <View style={[centerCardStyle(tokens)]}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }
  if (!liveEvent) {
    return <BeaconIdleView tokens={tokens} replay={current?.replay ?? null} />;
  }
  return (
    <BeaconLiveView
      tokens={tokens}
      accent={accent}
      liveEvent={liveEvent}
      hlsUrl={current?.hlsPlaybackUrl ?? null}
      isAuthenticated={isAuthenticated}
      chat={chat}
      chatError={chatError}
      onSignIn={onSignIn}
    />
  );
}

function centerCardStyle(t: ThemeTokens) {
  return {
    marginTop: 16,
    padding: 32,
    borderRadius: t.radius,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}

function makeStyles(_t: ThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    content: { padding: 16, paddingBottom: 32, gap: 4 },
    title: { fontSize: 22, fontWeight: '700' },
    subtitle: { fontSize: 13, marginBottom: 12 },
  });
}
