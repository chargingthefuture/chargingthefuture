/**
 * FoundationDirectLine — the mobile (Android) Direct Line chat surface for one Foundation connection
 * thread. Android parity for the web foundation-direct-line.tsx (issue #803).
 *
 * Given a threadId, it re-mints fresh Stream credentials from
 * GET /api/foundation/connections/threads/:threadId/token (via fetchThreadDirectLineCredentials) and
 * renders the 1:1 conversation with the SAME shared StreamChatView used by Chyme and the other plugin
 * chats — so @mentions, in-channel search, link previews, reply threads and reactions all work here
 * too. The chat channel is created at Request-Quote time; this screen connects to it.
 *
 * Real-data-only: it renders only what the token route returns (the four Stream fields) plus the
 * caller-supplied subtitle (who the conversation is with). It invents no lifecycle gating: whether a
 * thread is writable is governed server-side (a closed/terminal thread is read-only, mirroring the
 * web, which also delegates that to the server and the Stream channel rather than drawing its own
 * read-only banner).
 *
 * Covers loading / error / connecting states; the empty state (a thread with no messages yet) is
 * rendered by StreamChatView's own empty message list.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StreamChatView } from '../../components/shared/StreamChatView';
import { fetchThreadDirectLineCredentials, type DirectLineCredentials, type DirectLineError } from './api';

// Foundation accent (matches the web Direct Line accent and the rest of the mobile Foundation screens).
const COLOR = '#F59E0B';
const BG = '#0F1117';
const SURFACE_DARK = '#090B0F';
const TEXT = '#F9FAFB';
const TEXT_DIM = '#9CA3AF';
const ERROR = '#EF4444';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; credentials: DirectLineCredentials };

function isDirectLineError(value: unknown): value is DirectLineError {
  return typeof value === 'object' && value !== null && 'message' in value;
}

interface FoundationDirectLineProps {
  // The connection thread whose Direct Line to open.
  threadId: string;
  // Who the conversation is with, shown under the "Direct Line" heading. Null when not known.
  subtitle?: string | null;
  onBack: () => void;
}

export function FoundationDirectLine({ threadId, subtitle, onBack }: FoundationDirectLineProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    fetchThreadDirectLineCredentials(threadId)
      .then((credentials) => {
        if (active) setState({ status: 'ready', credentials });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = isDirectLineError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not open this Direct Line.';
        setState({ status: 'error', message });
      });
    return () => {
      active = false;
    };
  }, [threadId]);

  return (
    <View style={styles.container}>
      {/* Status bar — matches the other Foundation screens. */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusSignal}>100%</Text>
      </View>

      {/* Nav bar: back control + "Direct Line" heading with the optional who-with subtitle. */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
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
            <ActivityIndicator color={COLOR} size="large" />
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
            accentColor={COLOR}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  statusBar: {
    height: 44,
    backgroundColor: SURFACE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  statusTime: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  statusSignal: {
    fontSize: 12,
    color: TEXT_DIM,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: SURFACE_DARK,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backIcon: {
    color: COLOR,
    fontSize: 16,
  },
  backLabel: {
    color: COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
  },
  navSubtitle: {
    fontSize: 12,
    color: TEXT_DIM,
    textAlign: 'center',
    marginTop: 2,
  },
  navRight: {
    width: 56,
  },
  body: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  centeredText: {
    fontSize: 14,
    color: TEXT_DIM,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: ERROR,
    textAlign: 'center',
    lineHeight: 21,
  },
});
