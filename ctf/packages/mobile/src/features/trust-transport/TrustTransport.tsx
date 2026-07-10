import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { useAuth } from './auth-context';
import { TrustTransportLoadingState } from './TrustTransportLoadingState';
import { TrustTransportOffersSection } from './TrustTransportOffersSection';
import { TrustTransportHelpTab } from './TrustTransportHelpTab';
import { TrustTransportChatButton } from './TrustTransportChatButton';
import { TrustTransportEarningsTab } from './TrustTransportEarningsTab';
import {
  cancelOrder,
  confirmTripCompletion,
  createRequest,
  listRequests,
  type ListRequestsResponse,
} from './api';
import { ttSettlementLabel, type TrustTransportMode, type TrustTransportRequest } from './types';
import { CurrencySelect } from '../currency';
import type { Currency } from '../currency';

// Left raw by design: SUBTLE (#9CA3AF) has no exact-value mobile token equivalent.
const SUBTLE = '#9CA3AF';

type Tab = 'ride' | 'package' | 'track' | 'help' | 'earnings';

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({ isLive }: { isLive: boolean }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>🚗</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>TrustTransport</Text>
          {/* Driver count not backed by API — omitted per real-data-only rule */}
        </View>
      </View>
      {isLive && (
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>● Live</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bottom nav
// ---------------------------------------------------------------------------
const NAV_ITEMS: { label: string; key: Tab; emoji: string }[] = [
  { label: 'Ride', key: 'ride', emoji: '🚗' },
  { label: 'Package', key: 'package', emoji: '📦' },
  { label: 'Track', key: 'track', emoji: '📍' },
  { label: 'Help', key: 'help', emoji: '🤝' },
  { label: 'Earnings', key: 'earnings', emoji: '💰' },
];

function BottomNav({ active, onPress }: { active: Tab; onPress: (_t: Tab) => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.nav}>
      {NAV_ITEMS.map(({ label, key, emoji }) => (
        <TouchableOpacity
          key={key}
          style={styles.navBtn}
          onPress={() => onPress(key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === key }}
        >
          <View style={[styles.navIconWrap, active === key && styles.navIconWrapActive]}>
            <Text style={styles.navEmoji}>{emoji}</Text>
          </View>
          <Text style={[styles.navLabel, active === key && styles.navLabelActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Book tab — ride or package mode
// ---------------------------------------------------------------------------
interface BookTabProps {
  mode: TrustTransportMode;
  onSubmitted: () => void;
}

function BookTab({ mode, onSubmitted }: BookTabProps) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // How the requester will settle the ride (issue #420): default Free; amount only for priced types.
  const [priceCurrency, setPriceCurrency] = useState('FREE');
  const [priceAmount, setPriceAmount] = useState('');
  const [requiresAmount, setRequiresAmount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const modeName = mode === 'ride' ? 'Ride' : mode === 'package' ? 'Package' : 'Food';

  // A priced value type (ServiceCredits, fiat, crypto) needs a positive amount; Free/Barter don't.
  const parsedPriceAmount = Number(priceAmount);
  const hasValidAmount = !requiresAmount || (Number.isFinite(parsedPriceAmount) && parsedPriceAmount > 0);

  async function handleSubmit() {
    if (!from.trim() || !to.trim()) {
      setError('Please enter pickup and destination.');
      return;
    }
    if (!hasValidAmount) {
      setError('Enter an amount greater than zero for this value type.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createRequest(
        {
          mode,
          title: `${modeName} request`,
          details: '',
          pickupCity: from.trim(),
          dropoffCity: to.trim(),
          pickupGeoRedacted: null,
          dropoffGeoRedacted: null,
          priceCurrency: priceCurrency || null,
          priceAmount: requiresAmount ? parsedPriceAmount : null,
        },
        `${Date.now()}-${Math.random()}`,
      );
      setDone(true);
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View style={styles.bookedBox}>
        <Text style={styles.bookedTitle}>Request submitted!</Text>
        <Text style={styles.bookedDesc}>
          Your request is now visible to community members who can offer to help.
        </Text>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => { setDone(false); setFrom(''); setTo(''); setPriceCurrency('FREE'); setPriceAmount(''); setRequiresAmount(false); }}
        >
          <Text style={styles.secondaryBtnText}>Book Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.bookSection}>
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Book a {modeName}</Text>
        <Text style={styles.sectionDesc}>
          Fellow community members · Trauma-informed · ServiceCredits OK
        </Text>
      </View>
      <View style={styles.inputGroup}>
        <View style={styles.inputWrap}>
          <View style={styles.dotGreen} />
          <TextInput
            value={from}
            onChangeText={setFrom}
            placeholder="Pickup location (private)"
            placeholderTextColor={tokens.textSecondary}
            style={styles.input}
            accessibilityLabel="Pickup location"
          />
        </View>
        <View style={styles.inputWrap}>
          <View style={styles.dotOrange} />
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="Where to?"
            placeholderTextColor={tokens.textSecondary}
            style={styles.input}
            accessibilityLabel="Destination"
          />
        </View>
      </View>
      <Text style={styles.settleLabel}>How will you settle this ride?</Text>
      <CurrencySelect
        value={priceCurrency}
        onChange={(code, currency: Currency | null) => {
          const needs = currency?.requiresAmount ?? false;
          setPriceCurrency(code);
          setRequiresAmount(needs);
          if (!needs) setPriceAmount('');
        }}
      />
      {requiresAmount ? (
        <TextInput
          value={priceAmount}
          onChangeText={(t) => setPriceAmount(t.replace(/[^0-9.]/g, ''))}
          placeholder="Amount (e.g. 20)"
          placeholderTextColor={tokens.textSecondary}
          keyboardType="decimal-pad"
          style={styles.input}
          accessibilityLabel="Amount"
        />
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.primaryBtn, (submitting || !hasValidAmount) && styles.primaryBtnDisabled]}
        onPress={() => { void handleSubmit(); }}
        disabled={submitting || !hasValidAmount}
        accessibilityRole="button"
      >
        {submitting
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.primaryBtnText}>Book {modeName}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Track tab — real requests from API
// ---------------------------------------------------------------------------
function statusColor(status: string, accent: string): string {
  if (status === 'completed') return '#22C55E';
  if (status === 'in_progress' || status === 'accepted') return accent;
  if (status === 'cancelled' || status === 'disputed' || status === 'emergency_frozen') return '#EF4444';
  return SUBTLE;
}

const TERMINAL_REQUEST_STATUSES = new Set(['completed', 'cancelled']);

function CancelRequestButton({ requestId, onCancelled }: { requestId: string; onCancelled: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doCancel() {
    setCancelling(true);
    setError(null);
    try {
      await cancelOrder(requestId);
      onCancelled();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not cancel this request.');
    } finally {
      setCancelling(false);
    }
  }

  function confirmCancel() {
    Alert.alert('Cancel this request?', "This can't be undone.", [
      { text: 'Keep request', style: 'cancel' },
      { text: 'Cancel request', style: 'destructive', onPress: () => { void doCancel(); } },
    ]);
  }

  return (
    <>
      {error ? <Text style={styles.cancelErrorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]}
        onPress={confirmCancel}
        disabled={cancelling}
        accessibilityRole="button"
      >
        {cancelling ? <ActivityIndicator size="small" color={tokens.danger} /> : <Text style={styles.cancelBtnText}>Cancel request</Text>}
      </TouchableOpacity>
    </>
  );
}

// Requester side of mutual completion confirmation (owner decision, 2026-07-08): once the trip is
// 'delivered', the ride isn't complete (and no ServiceCredits move / no off-platform exchange is recorded
// as settled) until both the requester and the provider confirm on-platform.
function RequesterCompletionConfirm({ tripId, myConfirmedAtIso, otherConfirmedAtIso, onConfirmed }: { tripId: string; myConfirmedAtIso: string | null; otherConfirmedAtIso: string | null; onConfirmed: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await confirmTripCompletion(tripId);
      onConfirmed();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not confirm completion.');
    } finally {
      setSubmitting(false);
    }
  }

  if (myConfirmedAtIso) {
    return (
      <View style={styles.completionWaiting}>
        <Text style={styles.completionWaitingText}>You confirmed completion. Waiting for the other party to confirm.</Text>
      </View>
    );
  }

  return (
    <View style={styles.completionConfirm}>
      {error ? <Text style={styles.cancelErrorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.confirmCompletionBtn, submitting && styles.cancelBtnDisabled]}
        onPress={() => { void confirm(); }}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? <ActivityIndicator size="small" color={accent} /> : <Text style={styles.confirmCompletionBtnText}>✓ Confirm trip completed</Text>}
      </TouchableOpacity>
      {otherConfirmedAtIso ? <Text style={styles.completionHint}>The other party has already confirmed — this finishes it.</Text> : null}
    </View>
  );
}

function TrackTab({
  requests,
  loading,
  onRefresh,
}: {
  requests: TrustTransportRequest[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (requests.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>📍</Text>
        <Text style={styles.emptyTitle}>No active requests</Text>
        <Text style={styles.emptyDesc}>Book a ride, package, or food delivery to see it here.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.trackList}>
      <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} accessibilityRole="button">
        <Text style={styles.refreshBtnText}>Refresh</Text>
      </TouchableOpacity>
      {requests.map((req) => (
        <React.Fragment key={req.id}>
          <View style={styles.requestCard}>
            <View style={styles.requestCardRow}>
              <Text style={styles.requestMode}>{req.mode.toUpperCase()}</Text>
              <View style={[styles.statusBadge, { borderColor: statusColor(req.status, accent) + '50' }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor(req.status, accent) }]}>
                  {req.status.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            {req.pickupCity ? (
              <Text style={styles.requestLocation}>From: {req.pickupCity}</Text>
            ) : null}
            {req.dropoffCity ? (
              <Text style={styles.requestLocation}>To: {req.dropoffCity}</Text>
            ) : null}
            <Text style={styles.requestSettle}>{ttSettlementLabel(req.priceCurrency, req.priceAmount)}</Text>
            {req.status === 'open' ? (
              <TrustTransportOffersSection requestId={req.id} onAccepted={onRefresh} />
            ) : null}
            {req.tripId && req.tripStatus === 'delivered' ? (
              <RequesterCompletionConfirm
                tripId={req.tripId}
                myConfirmedAtIso={req.requesterCompletionConfirmedAtIso}
                otherConfirmedAtIso={req.providerCompletionConfirmedAtIso}
                onConfirmed={onRefresh}
              />
            ) : null}
            {req.tripId ? <TrustTransportChatButton tripId={req.tripId} /> : null}
            {!TERMINAL_REQUEST_STATUSES.has(req.status) ? (
              <CancelRequestButton requestId={req.id} onCancelled={onRefresh} />
            ) : null}
          </View>
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Empty / unauthenticated / loading states
// ---------------------------------------------------------------------------
function PublicState({ onSignIn }: { onSignIn: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <ScrollView contentContainerStyle={styles.publicContent}>
      <View style={styles.publicHeadRow}>
        <Text style={styles.publicTitle}>TrustTransport</Text>
      </View>
      <Text style={styles.publicDesc}>
        Rides, package delivery, and food from fellow community members.
        Pay with ServiceCredits.
      </Text>
      <View style={styles.serviceRow}>
        {[
          { emoji: '🚗', label: 'Rides' },
          { emoji: '📦', label: 'Packages' },
          { emoji: '🍽️', label: 'Food' },
        ].map(({ emoji, label }) => (
          <React.Fragment key={label}>
            <View style={styles.serviceCard}>
              <Text style={styles.serviceEmoji}>{emoji}</Text>
              <Text style={styles.serviceLabel}>{label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      <TouchableOpacity style={styles.joinBtn} onPress={onSignIn} accessibilityRole="button">
        <Text style={styles.joinBtnText}>Join the Hub — Free</Text>
      </TouchableOpacity>
      {/* Blurred driver list placeholder — no real driver data available unauthenticated */}
      <View style={styles.blurredPlaceholder}>
        <View style={styles.lockCircle}>
          <Text style={styles.lockEmoji}>🔒</Text>
        </View>
        <Text style={styles.lockTitle}>Sign in to book transport</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={onSignIn} accessibilityRole="button">
          <Text style={styles.signInBtnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export const TrustTransport = () => {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [tab, setTab] = useState<Tab>('ride');
  const [requests, setRequests] = useState<TrustTransportRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!isAuthenticated) return;
    setRequestsLoading(true);
    try {
      const res: ListRequestsResponse = await listRequests(1);
      setRequests(res.items);
    } catch {
      // non-fatal; show empty list
    } finally {
      setRequestsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadRequests();
  }, [isAuthenticated, loadRequests]);

  if (isLoading) return <TrustTransportLoadingState />;

  if (!isAuthenticated) {
    return (
      <View style={styles.root}>
        <PublicState onSignIn={() => { void signIn(); }} />
      </View>
    );
  }

  const bookMode: TrustTransportMode = tab === 'package' ? 'package' : 'ride';

  return (
    <View style={styles.root}>
      <Header isLive />
      <ScrollView style={styles.scroll}>
        {tab === 'track' ? (
          <TrackTab requests={requests} loading={requestsLoading} onRefresh={() => { void loadRequests(); }} />
        ) : tab === 'help' ? (
          <TrustTransportHelpTab />
        ) : tab === 'earnings' ? (
          <TrustTransportEarningsTab />
        ) : (
          <BookTab mode={bookMode} onSubmitted={() => { void loadRequests(); }} />
        )}
      </ScrollView>
      <BottomNav active={tab} onPress={setTab} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  header: {
    height: 60,
    backgroundColor: t.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${accent}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
  liveBadge: {
    backgroundColor: `${t.success}20`,
    borderWidth: 1,
    borderColor: `${t.success}35`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  liveBadgeText: { fontSize: 11, color: t.success, fontWeight: '700' },
  scroll: { flex: 1 },
  nav: {
    height: 72,
    backgroundColor: t.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: t.borderFaint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8 },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapActive: { backgroundColor: `${accent}20` },
  navEmoji: { fontSize: 18 },
  navLabel: { fontSize: 10, color: t.textMuted, fontWeight: '400' },
  navLabelActive: { color: accent, fontWeight: '600' },
  bookSection: { padding: 16 },
  sectionBox: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: `${accent}08`,
    borderWidth: 1,
    borderColor: `${accent}18`,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: t.textSecondary },
  inputGroup: { marginBottom: 16, gap: 10 },
  inputWrap: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  dotGreen: {
    position: 'absolute',
    left: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    zIndex: 1,
  },
  dotOrange: {
    position: 'absolute',
    left: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent,
    zIndex: 1,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: t.radius,
    fontSize: 14,
    color: t.textShell,
    paddingVertical: 14,
    paddingLeft: 32,
    paddingRight: 14,
    marginBottom: 0,
  },
  errorText: { fontSize: 13, color: t.danger, marginBottom: 12 },
  primaryBtn: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: `${accent}40` },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  secondaryBtnText: { color: t.textSecondary, fontSize: 13 },
  bookedBox: {
    margin: 16,
    padding: 20,
    borderRadius: 14,
    backgroundColor: `${t.success}10`,
    borderWidth: 1,
    borderColor: `${t.success}30`,
  },
  bookedTitle: { fontSize: 16, fontWeight: '700', color: t.success, marginBottom: 6 },
  bookedDesc: { fontSize: 13, color: t.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: t.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: t.textSecondary, textAlign: 'center' },
  trackList: { padding: 16, gap: 12 },
  refreshBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${accent}15`,
    borderWidth: 1,
    borderColor: `${accent}30`,
    marginBottom: 12,
  },
  refreshBtnText: { fontSize: 12, color: accent, fontWeight: '600' },
  requestCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: `${accent}20`,
    marginBottom: 10,
  },
  requestCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  requestMode: { fontSize: 11, fontWeight: '700', color: accent, letterSpacing: 1 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: t.radiusChip,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  requestLocation: { fontSize: 13, color: t.textSecondary, marginBottom: 2 },
  requestSettle: { fontSize: 12, fontWeight: '700', color: t.success, marginTop: 2, marginBottom: 2 },
  settleLabel: { fontSize: 13, color: t.textSecondary, marginTop: 10, marginBottom: 6 },
  cancelBtn: {
    marginTop: 8,
    padding: 10,
    borderRadius: 9,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
  },
  cancelBtnDisabled: { opacity: 0.6 },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: t.danger },
  cancelErrorText: { fontSize: 12, color: t.danger, marginTop: 8 },
  completionConfirm: { marginTop: 8 },
  confirmCompletionBtn: {
    padding: 10,
    borderRadius: 9,
    backgroundColor: `${accent}1F`,
    borderWidth: 1,
    borderColor: `${accent}40`,
    alignItems: 'center',
  },
  confirmCompletionBtnText: { fontSize: 13, fontWeight: '600', color: accent },
  completionWaiting: {
    marginTop: 8,
    padding: 10,
    borderRadius: 9,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  completionWaitingText: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  completionHint: { marginTop: 6, fontSize: 11, color: t.textSecondary },
  publicContent: { padding: 20 },
  publicHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  publicTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
  publicDesc: { fontSize: 14, color: t.textSecondary, lineHeight: 21, marginBottom: 16 },
  serviceRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  serviceCard: {
    flex: 1,
    borderRadius: t.radius,
    borderWidth: 1,
    borderColor: `${accent}40`,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${accent}08`,
  },
  serviceEmoji: { fontSize: 20 },
  serviceLabel: { fontSize: 12, fontWeight: '600', color: t.textPrimary },
  joinBtn: {
    padding: 14,
    borderRadius: t.radius,
    backgroundColor: accent,
    alignItems: 'center',
    marginBottom: 20,
  },
  joinBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  blurredPlaceholder: {
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    gap: 12,
  },
  lockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: `${accent}50`,
    backgroundColor: `${accent}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockEmoji: { fontSize: 20 },
  lockTitle: { fontSize: 15, fontWeight: '700', color: t.textPrimary, textAlign: 'center' },
  signInBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: accent,
  },
  signInBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });
}
