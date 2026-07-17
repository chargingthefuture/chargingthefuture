/**
 * SocketRelayDirectLineChat — the mobile (Android) live chat surface for one SocketRelay Direct Line
 * (one fulfillment's requester <-> helper conversation). Android parity for the web sr-chat.tsx
 * ChatPane / StreamChatPanel (issue #1596).
 *
 * Given a fulfillmentId, it mints Stream credentials from POST /api/socket-relay/fulfillments/:id/chat
 * (via fetchFulfillmentChatCredentials) and renders the 1:1 conversation with the SAME shared
 * StreamChatView used by Foundation, Chyme and the other plugin chats — so @mentions, in-channel
 * search, link previews, reply threads and reactions all work here too. The channel is the same
 * per-fulfillment Stream channel the web opens (`socket-relay-fulfillment-<id>`); this screen just
 * connects a second client to it — no new channel type.
 *
 * Covers loading / error / connecting states; the empty state (a Direct Line with no messages yet) is
 * rendered by StreamChatView's own empty message list.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StreamChatView } from '../../components/shared/StreamChatView';
import { fetchFulfillmentChatCredentials, type SocketRelayChatCredentials } from './api';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; credentials: SocketRelayChatCredentials };

interface SocketRelayDirectLineChatProps {
  // The fulfillment whose Direct Line to open.
  fulfillmentId: string;
  // The role/context line shown under the "Direct Line" heading (who you are talking with).
  subtitle?: string | null;
  onBack: () => void;
}

export function SocketRelayDirectLineChat({
  fulfillmentId,
  subtitle,
  onBack,
}: SocketRelayDirectLineChatProps) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('socket-relay', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    fetchFulfillmentChatCredentials(fulfillmentId)
      .then((credentials) => {
        if (active) setState({ status: 'ready', credentials });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : 'Could not open this Direct Line chat.';
        setState({ status: 'error', message });
      });
    return () => {
      active = false;
    };
  }, [fulfillmentId]);

  return (
    <View style={styles.container}>
      {/* Nav bar: back control + "Direct Line" heading with the optional who-with subtitle. */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Close chat"
        >
          <Text style={styles.backIcon}>&#8592;</Text>
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.navTitle}>Direct Line</Text>
          {subtitle ? (
            <Text style={styles.navSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.navRight} />
      </View>

      {/* Body: loading / error / live chat. */}
      <View style={styles.body}>
        {state.status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={accent} size="large" />
            <Text style={styles.centeredText}>Opening Direct Line…</Text>
          </View>
        ) : state.status === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{state.message}</Text>
          </View>
        ) : (
          <StreamChatView
            streamApiKey={state.credentials.streamApiKey}
            streamToken={state.credentials.streamToken}
            streamUserId={state.credentials.streamUserId}
            streamChannelId={state.credentials.streamChannelId}
            accentColor={accent}
          />
        )}
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
      gap: 12,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backIcon: { color: accent, fontSize: 16 },
    backLabel: { color: accent, fontSize: 14, fontWeight: '600' },
    titleWrap: { flex: 1, alignItems: 'center' },
    navTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary, textAlign: 'center' },
    navSubtitle: { fontSize: 12, color: t.textSecondary, textAlign: 'center', marginTop: 2 },
    navRight: { width: 56 },
    body: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    centeredText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' },
    errorText: { fontSize: 14, color: t.danger, textAlign: 'center', lineHeight: 21 },
  });
}
