import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from './auth-context';
import { TrustTransportLoadingState } from './TrustTransportLoadingState';
import { TrustTransportHelpTab } from './TrustTransportHelpTab';
import {
  createRequest,
  listRequests,
  type ListRequestsResponse,
} from './api';
import { ttSettlementLabel, type TrustTransportMode, type TrustTransportRequest } from './types';
import { CurrencySelect } from '../currency';
import type { Currency } from '../currency';

const COLOR = '#38BDF8';
const BG = '#0F1117';
const SURFACE = '#090B0F';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT = '#F9FAFB';
const MUTED = '#6B7280';
const SUBTLE = '#9CA3AF';

type Tab = 'ride' | 'package' | 'track' | 'help';

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({ isLive }: { isLive: boolean }) {
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
];

function BottomNav({ active, onPress }: { active: Tab; onPress: (_t: Tab) => void }) {
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
          Your request is being matched with nearby drivers.
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
        <Text style={styles.sectionTitle}>Book a Safe {modeName}</Text>
        <Text style={styles.sectionDesc}>
          Background-checked drivers · Trauma-informed · ServiceCredits OK
        </Text>
      </View>
      <View style={styles.inputGroup}>
        <View style={styles.inputWrap}>
          <View style={styles.dotGreen} />
          <TextInput
            value={from}
            onChangeText={setFrom}
            placeholder="Pickup location (private)"
            placeholderTextColor={MUTED}
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
            placeholderTextColor={MUTED}
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
          placeholderTextColor={MUTED}
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
function statusColor(status: string): string {
  if (status === 'completed') return '#22C55E';
  if (status === 'in_progress' || status === 'accepted') return COLOR;
  if (status === 'cancelled' || status === 'disputed' || status === 'emergency_frozen') return '#EF4444';
  return SUBTLE;
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
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLOR} />
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
              <View style={[styles.statusBadge, { borderColor: statusColor(req.status) + '50' }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor(req.status) }]}>
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
            <View style={styles.safetyRow}>
              <Text style={styles.safetyItem}>🛡️ Background checked</Text>
              <Text style={styles.safetyItem}>✅ ID verified</Text>
            </View>
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
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    height: 60,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    backgroundColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: TEXT },
  liveBadge: {
    backgroundColor: '#22C55E20',
    borderWidth: 1,
    borderColor: '#22C55E35',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  liveBadgeText: { fontSize: 11, color: '#22C55E', fontWeight: '700' },
  scroll: { flex: 1 },
  nav: {
    height: 72,
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
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
  navIconWrapActive: { backgroundColor: `${COLOR}20` },
  navEmoji: { fontSize: 18 },
  navLabel: { fontSize: 10, color: '#4B5563', fontWeight: '400' },
  navLabelActive: { color: COLOR, fontWeight: '600' },
  bookSection: { padding: 16 },
  sectionBox: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: `${COLOR}08`,
    borderWidth: 1,
    borderColor: `${COLOR}18`,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: TEXT, marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: MUTED },
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
    backgroundColor: COLOR,
    zIndex: 1,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    fontSize: 14,
    color: '#E8EAF0',
    paddingVertical: 14,
    paddingLeft: 32,
    paddingRight: 14,
    marginBottom: 0,
  },
  errorText: { fontSize: 13, color: '#EF4444', marginBottom: 12 },
  primaryBtn: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: `${COLOR}40` },
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
  secondaryBtnText: { color: SUBTLE, fontSize: 13 },
  bookedBox: {
    margin: 16,
    padding: 20,
    borderRadius: 14,
    backgroundColor: '#22C55E10',
    borderWidth: 1,
    borderColor: '#22C55E30',
  },
  bookedTitle: { fontSize: 16, fontWeight: '700', color: '#22C55E', marginBottom: 6 },
  bookedDesc: { fontSize: 13, color: SUBTLE },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: MUTED, textAlign: 'center' },
  trackList: { padding: 16, gap: 12 },
  refreshBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    marginBottom: 12,
  },
  refreshBtnText: { fontSize: 12, color: COLOR, fontWeight: '600' },
  requestCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: `${COLOR}20`,
    marginBottom: 10,
  },
  requestCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  requestMode: { fontSize: 11, fontWeight: '700', color: COLOR, letterSpacing: 1 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  requestLocation: { fontSize: 13, color: SUBTLE, marginBottom: 2 },
  requestSettle: { fontSize: 12, fontWeight: '700', color: '#22C55E', marginTop: 2, marginBottom: 2 },
  settleLabel: { fontSize: 13, color: MUTED, marginTop: 10, marginBottom: 6 },
  safetyRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  safetyItem: { fontSize: 11, color: MUTED },
  publicContent: { padding: 20 },
  publicHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  publicTitle: { fontSize: 20, fontWeight: '800', color: TEXT },
  publicDesc: { fontSize: 14, color: SUBTLE, lineHeight: 21, marginBottom: 16 },
  serviceRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  serviceCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLOR}08`,
  },
  serviceEmoji: { fontSize: 20 },
  serviceLabel: { fontSize: 12, fontWeight: '600', color: TEXT },
  joinBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLOR,
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
    borderColor: `${COLOR}50`,
    backgroundColor: `${COLOR}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockEmoji: { fontSize: 20 },
  lockTitle: { fontSize: 15, fontWeight: '700', color: TEXT, textAlign: 'center' },
  signInBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: COLOR,
  },
  signInBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
