/**
 * Beacon — the Beacon screen in the Android app: watch, chat, and (for an admin) go live.
 *
 * Owner decision, 2026-10-06: the Android app carries any plugin that materially benefits from being
 * an installed app. Beacon does, because an installed Android app can share the phone's screen and a
 * web page cannot (rule 105).
 *
 * The content below the screen header copies the web member page (components/beacon/beacon-viewer.tsx):
 * the radio icon and "Beacon" title, the one-line description, then the viewer. It polls the public
 * GET /api/beacon/current every 15 seconds (the same cadence as the web viewer) and renders one of
 * three states:
 *   live    → HLS player + a "LIVE AND PUBLIC" badge. A signed-in member also gets the live chat;
 *             a signed-out viewer sees a "sign in to chat" prompt instead. (BeaconLiveView)
 *   replay  → nothing live, but the response carries the last replay's recording. (BeaconIdleView)
 *   idle    → a calm "no live event right now" empty state. (BeaconIdleView)
 * An admin also sees BeaconHostPanel above it, the go-live cards of the web admin page: go live with
 * the camera and microphone, or share the phone's screen.
 *
 * This file owns the polling, the chat-token lifecycle, and which state to show.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Radio } from 'lucide-react-native';
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
import { useTheme } from '../../theme';
import { font, getBeaconTokens, panelStyle, type BeaconTokens } from './BeaconTheme';
import { reportError } from '../../observability/report';

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
  const t = React.useMemo(() => getBeaconTokens(tokens, theme), [tokens, theme]);
  const { isAuthenticated, signIn, user } = useAuth();

  const [current, setCurrent] = useState<BeaconCurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCurrent = useCallback(async () => {
    try {
      setCurrent(await getBeaconCurrent());
    } catch (error) {
      // Network blip: keep the last known state and try again on the next poll, like the web viewer.
      // The first failure (no prior state) falls through to idle. Reported so a lasting failure shows.
      reportError(error, { area: 'beacon', op: 'current_poll' });
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
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Radio size={22} color={t.ACCENT} />
        <Text style={[styles.title, { color: t.TITLE }]}>Beacon</Text>
      </View>
      <Text style={[styles.subtitle, { color: t.SUBTLE }]}>
        Live broadcasts from Farah. Watch with just a link; sign in to chat and react.
      </Text>

      {user?.isAdmin ? (
        <BeaconHostPanel t={t} displayName={hostName(user.username)} onChanged={() => void loadCurrent()} />
      ) : null}

      <BeaconBody
        t={t}
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
function BeaconBody({ t, loading, current, liveEvent, isAuthenticated, chat, chatError, onSignIn }: {
  t: BeaconTokens;
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
      <View style={panelStyle(t)}>
        <Text style={[styles.loading, { color: t.TITLE }]}>Loading…</Text>
      </View>
    );
  }
  if (!liveEvent) {
    return <BeaconIdleView t={t} replay={current?.replay ?? null} />;
  }
  return (
    <BeaconLiveView
      t={t}
      liveEvent={liveEvent}
      hlsUrl={current?.hlsPlaybackUrl ?? null}
      isAuthenticated={isAuthenticated}
      chat={chat}
      chatError={chatError}
      onSignIn={onSignIn}
    />
  );
}

// The page has no background of its own, as on the web, so the app backdrop shows through.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingVertical: 32, paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  title: { fontSize: 24, ...font('700') },
  subtitle: { fontSize: 14, marginBottom: 14, ...font('400') },
  loading: { fontSize: 16, ...font('400') },
});
