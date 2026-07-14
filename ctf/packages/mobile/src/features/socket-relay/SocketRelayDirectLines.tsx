import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  listMyFulfillments,
  listMyRequests,
  resolveFulfillment,
  type SocketRelayFulfillment,
  type SocketRelayRequest,
  type SocketRelayResolveOutcome,
} from './api';
import { SocketRelayLoading } from './SocketRelayLoading';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

// The four outcomes a requester can pick. Mirrors the web ResolveBar (sr-chat.tsx) exactly:
// labels, colors, and the meaning of each outcome are kept in sync with the web Direct Line.
const RESOLVE_ACTIONS: {
  outcome: SocketRelayResolveOutcome;
  label: string;
  color: string;
}[] = [
  { outcome: 'successful', label: 'Mark successful', color: '#22C55E' },
  { outcome: 'no_longer_needed', label: 'No longer needed', color: '#6B7280' },
  { outcome: 'unsuccessful_reopen', label: "Didn't work — reopen for others", color: '#FBBF24' },
  { outcome: 'unsuccessful_close', label: "Didn't work — close", color: '#EF4444' },
];

function fulfillmentTitle(f: SocketRelayFulfillment): string {
  return f.requestTitle && f.requestTitle.trim().length > 0
    ? f.requestTitle
    : `Request ${f.id.slice(0, 8)}`;
}

// One Direct Line card: request title, the member's role (your request vs you're helping), and —
// for the requester on an active line — the four resolve actions. The helper sees a short note.
function DirectLineCard({
  fulfillment,
  isRequester,
  resolving,
  onResolve,
}: {
  fulfillment: SocketRelayFulfillment;
  isRequester: boolean;
  resolving: boolean;
  onResolve: (_fulfillmentId: string, _outcome: SocketRelayResolveOutcome) => void;
}) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('socket-relay', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const isActive = fulfillment.status === 'active';
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{fulfillmentTitle(fulfillment)}</Text>
      <Text style={styles.cardRole}>
        {isRequester
          ? "Your request — you're talking with the helper."
          : 'You offered to help — talking with the requester.'}
      </Text>

      {!isActive ? (
        <Text style={styles.note}>
          This request is{' '}
          {fulfillment.requestStatus === 'open' ? 'open again' : 'closed'}.
        </Text>
      ) : !isRequester ? (
        <Text style={styles.note}>
          Only the person who posted this request can close it.
        </Text>
      ) : (
        <View style={styles.actionRow}>
          {RESOLVE_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.outcome}
              style={[
                styles.actionBtn,
                { backgroundColor: `${a.color}14`, borderColor: `${a.color}40` },
                resolving && styles.actionBtnDisabled,
              ]}
              onPress={() => onResolve(fulfillment.id, a.outcome)}
              disabled={resolving}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <Text style={[styles.actionBtnText, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// A pending request card: a request the member posted that no helper has claimed yet. There is no
// helper to chat with, so it explains what happens next instead of showing resolve actions.
function PendingRequestCard({ request }: { request: SocketRelayRequest }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('socket-relay', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{request.title}</Text>
      <Text style={styles.cardRole}>Your request · Waiting for a helper</Text>
      <Text style={styles.note}>
        This request is still open on the feed. As soon as someone offers to help, your Direct Line
        opens here and you can talk it through.
      </Text>
    </View>
  );
}

// The Direct Lines tab: one row per request the member is currently waiting on or talking through —
// active fulfillments (live conversations) plus the member's own still-open requests as pending
// placeholders. Cancelled/closed fulfillments drop out. `currentUserId` decides requester-vs-helper
// (from useAuth().user.id) and surfaces requester-only resolve controls.
export function SocketRelayDirectLines({ currentUserId }: { currentUserId?: string }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('socket-relay', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [fulfillments, setFulfillments] = useState<SocketRelayFulfillment[]>([]);
  const [myRequests, setMyRequests] = useState<SocketRelayRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    Promise.all([listMyFulfillments(), listMyRequests()])
      .then(([fulRes, reqRes]) => {
        setFulfillments(fulRes.items);
        setMyRequests(reqRes.items);
      })
      .catch(() => setError('Failed to load your Direct Lines.'))
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = useCallback(
    async (fulfillmentId: string, outcome: SocketRelayResolveOutcome) => {
      setResolving(true);
      setResolveError(null);
      try {
        await resolveFulfillment(fulfillmentId, outcome);
        // Refresh so the resolved/reopened state is reflected; do not show the full loading screen.
        load(false);
      } catch (e) {
        setResolveError(
          e instanceof Error ? e.message : "Couldn't resolve this request. Please try again.",
        );
      } finally {
        setResolving(false);
      }
    },
    [load],
  );

  if (loading) {
    return <SocketRelayLoading />;
  }

  if (error) {
    return (
      <View style={styles.centeredMsg}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Active fulfillments are live conversations; pending requests are the member's own still-open,
  // non-expired posts with no helper yet. Together they are the Direct Line list (active first).
  const activeFulfillments = fulfillments.filter((f) => f.status === 'active');
  const pendingRequests = myRequests.filter((r) => r.status === 'open' && !r.isExpired);

  if (activeFulfillments.length === 0 && pendingRequests.length === 0) {
    return (
      <View style={styles.centeredMsg}>
        <Text style={styles.emptyTitle}>No Direct Lines yet</Text>
        <Text style={styles.emptyBody}>
          Post a request or offer to help on one, and it shows up here as a private Direct Line.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.pad}>
        {resolving ? (
          <View style={styles.resolvingRow}>
            <ActivityIndicator size="small" color={accent} />
            <Text style={styles.resolvingText}>Resolving…</Text>
          </View>
        ) : null}
        {resolveError ? <Text style={styles.errorText}>{resolveError}</Text> : null}
        {activeFulfillments.map((f) => (
          <DirectLineCard
            key={f.id}
            fulfillment={f}
            isRequester={Boolean(currentUserId && f.requesterUserId === currentUserId)}
            resolving={resolving}
            onResolve={(id, outcome) => void handleResolve(id, outcome)}
          />
        ))}
        {pendingRequests.map((r) => (
          <PendingRequestCard key={`pending:${r.id}`} request={r} />
        ))}
      </View>
    </ScrollView>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  scroll: { flex: 1 },
  pad: { padding: 16 },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: `${accent}30`,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#F0FDF4', marginBottom: 4, lineHeight: 20 },
  cardRole: { fontSize: 12, color: t.textSecondary, marginBottom: 10 },
  note: { fontSize: 12, color: t.textSecondary, lineHeight: 18 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  centeredMsg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: t.textSecondary, marginBottom: 8 },
  emptyBody: {
    fontSize: 13,
    color: t.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  errorText: { color: '#F43F5E', textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: `${accent}20`,
    borderWidth: 1,
    borderColor: `${accent}40`,
  },
  retryBtnText: { color: accent, fontWeight: '700', fontSize: 13 },
  resolvingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resolvingText: { color: accent, fontSize: 13, fontWeight: '600' },
  });
}
