// SocketRelay admin screen (mobile) — parity with the web admin at
// ctf/packages/web/app/admin/socket-relay/page.tsx and the design target
// design/.../survivor-hub/MobileSocketRelayAdmin.tsx.
//
// Real data only. Binds the existing web admin routes (no new backend):
//   GET    /api/socket-relay/admin/requests
//   DELETE /api/socket-relay/admin/requests/:id   (destructive — confirm gesture required)
//   GET    /api/socket-relay/admin/fulfillments
//
// Admin access is enforced server-side; a 401/403 renders an "admins only" notice.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePluginAuth } from '../peer-programming/usePluginAuth';
import {
  deleteAdminRequest,
  fetchAdminOverview,
  type AdminFulfillment,
  type AdminRequest,
} from './admin-api';

// Design tokens (from MobileSocketRelayAdmin.tsx design-sync)
const COLOR = '#FB923C';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const PANEL = '#0D0F14';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

const STATUS_COLORS: Record<string, { fg: string; bg: string; border: string }> = {
  open: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  claimed: { fg: '#6366F1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)' },
  active: { fg: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  closed: { fg: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' },
  cancelled: { fg: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  published: { fg: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  draft: { fg: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' },
  archived: { fg: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
};

function StatusBadge({ status }: { status: string }) {
  const palette = STATUS_COLORS[status] ?? STATUS_COLORS.closed;
  return (
    <View
      style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={[styles.badgeText, { color: palette.fg }]}>{status}</Text>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ownerHandle(req: AdminRequest): string {
  return req.ownerUsername ? `@${req.ownerUsername}` : `user-${req.ownerUserId.slice(0, 8)}`;
}

function RequestCard({
  req,
  deleting,
  onDelete,
}: {
  req: AdminRequest;
  deleting: boolean;
  onDelete: (_requestId: string, _requestTitle: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardTitle}>{req.title}</Text>
          <Text style={styles.cardMeta}>
            {ownerHandle(req)} · {req.category}
            {req.city ? ` · ${req.city}` : ''}
          </Text>
        </View>
        <StatusBadge status={req.status} />
      </View>
      {req.details ? (
        <Text style={styles.cardBody} numberOfLines={3}>
          {req.details}
        </Text>
      ) : null}
      <Pressable
        style={[styles.deleteBtn, deleting ? styles.btnBusy : null]}
        onPress={() => onDelete(req.id, req.title)}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator size="small" color="#FCA5A5" />
        ) : (
          <Text style={styles.deleteBtnText}>Delete request</Text>
        )}
      </Pressable>
    </View>
  );
}

function FulfillmentCard({ item }: { item: AdminFulfillment }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardTitle}>Fulfillment {item.id.slice(0, 8)}</Text>
          <Text style={styles.cardMeta}>request {item.requestId.slice(0, 8)}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      {item.closeReason ? (
        <Text style={styles.cardBody}>Close reason: {item.closeReason}</Text>
      ) : null}
    </View>
  );
}

export const AdminSocketRelay = () => {
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [fulfillments, setFulfillments] = useState<AdminFulfillment[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) return;
    setError(null);
    const result = await fetchAdminOverview();
    if (!result.ok) {
      setForbidden(result.forbidden);
      if (!result.forbidden && result.message) setError(result.message);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setRequests(result.requests);
    setRequestsTotal(result.requestsTotal);
    setFulfillments(result.fulfillments);
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  const runDelete = useCallback(
    async (id: string) => {
      if (!auth?.userId) return;
      setDeletingId(id);
      setError(null);
      try {
        await deleteAdminRequest(id);
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setRequestsTotal((prev) => Math.max(0, prev - 1));
      } catch {
        setError('Could not delete the request. Try again.');
      } finally {
        setDeletingId(null);
      }
    },
    [auth],
  );

  // Destructive action: require an explicit confirm gesture before deleting.
  const confirmDelete = useCallback(
    (id: string, title: string) => {
      Alert.alert(
        'Delete request',
        `Delete "${title}"? This permanently removes the request and cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void runDelete(id) },
        ],
      );
    },
    [runDelete],
  );

  const openRequests = useMemo(
    () => requests.filter((r) => r.status === 'open').length,
    [requests],
  );
  const activeFulfillments = useMemo(
    () => fulfillments.filter((f) => f.status === 'active').length,
    [fulfillments],
  );

  if (authLoading || (loading && !forbidden && error === null)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR} />
      </View>
    );
  }

  if (!auth?.isAuthenticated || forbidden) {
    return (
      <View style={styles.center}>
        <Text style={styles.noticeText}>
          The SocketRelay admin tools are available to admins only.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>◉</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>SocketRelay Admin</Text>
          <Text style={styles.subtitle}>Request moderation</Text>
        </View>
        <View style={styles.adminTag}>
          <Text style={styles.adminTagText}>ADMIN</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <View style={styles.statGrid}>
        <StatCard label="Requests" value={requestsTotal} />
        <StatCard label="Open" value={openRequests} />
        <StatCard label="Fulfillments" value={fulfillments.length} />
        <StatCard label="Active" value={activeFulfillments} />
      </View>

      <Text style={styles.sectionLabel}>Requests</Text>
      {requests.length === 0 ? (
        <Text style={styles.emptyText}>No requests loaded.</Text>
      ) : (
        requests.map((req) => (
          <React.Fragment key={req.id}>
            <RequestCard
              req={req}
              deleting={deletingId === req.id}
              onDelete={confirmDelete}
            />
          </React.Fragment>
        ))
      )}

      <Text style={styles.sectionLabel}>Fulfillments</Text>
      {fulfillments.length === 0 ? (
        <Text style={styles.emptyText}>No fulfillments loaded.</Text>
      ) : (
        fulfillments.map((item) => (
          <React.Fragment key={item.id}>
            <FulfillmentCard item={item} />
          </React.Fragment>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { padding: 16, gap: 12 },
  center: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noticeText: { fontSize: 14, color: SUBTLE, textAlign: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}35`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { color: COLOR, fontSize: 16, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: TEXT },
  subtitle: { fontSize: 11, color: SUBTLE },
  adminTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  adminTagText: { fontSize: 11, fontWeight: '700', color: '#6366F1' },

  errorBanner: {
    fontSize: 13,
    color: '#FCA5A5',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statLabel: { fontSize: 11, color: SUBTLE },
  statValue: { fontSize: 20, fontWeight: '700', color: TEXT, marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    color: SUBTLE,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  emptyText: { fontSize: 13, color: SUBTLE },

  card: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: TEXT },
  cardMeta: { fontSize: 12, color: SUBTLE, marginTop: 2 },
  cardBody: { fontSize: 13, color: '#D1D5DB', lineHeight: 18 },

  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  btnBusy: { opacity: 0.7 },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
});
