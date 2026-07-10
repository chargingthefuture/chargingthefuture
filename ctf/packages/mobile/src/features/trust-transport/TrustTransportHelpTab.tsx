import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { listAvailableRequests, createOffer, listProviderTrips, updateTripStatus, captureProof } from './api';
import { ttSettlementLabel, type TrustTransportAvailableRequest, type TrustTransportProviderTrip } from './types';
import { TrustTransportChatButton } from './TrustTransportChatButton';

// Left raw by design: SUBTLE (#9CA3AF) has no exact-value mobile token equivalent.
const SUBTLE = '#9CA3AF';

function modeLabel(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

// The forward step a provider can take from each trip status (the happy path). Terminal states have none.
const NEXT_STEP: Record<string, { next: 'en_route' | 'picked_up' | 'delivered' | 'completed'; label: string }> = {
  assigned: { next: 'en_route', label: 'Start trip' },
  en_route: { next: 'picked_up', label: 'Mark picked up' },
  picked_up: { next: 'delivered', label: 'Mark delivered' },
  delivered: { next: 'completed', label: 'Mark complete' },
};

function tripStatusLabel(s: string): string {
  if (s === 'en_route') return 'En route';
  if (s === 'picked_up') return 'Picked up';
  if (s === 'emergency_frozen') return 'Emergency stop';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PROOF_TYPES: { key: 'photo' | 'code' | 'note'; label: string; placeholder: string }[] = [
  { key: 'photo', label: 'Photo', placeholder: 'Photo reference or short description' },
  { key: 'code', label: 'Code', placeholder: 'Confirmation code' },
  { key: 'note', label: 'Note', placeholder: 'Short note' },
];

// Capture pickup/delivery proof as a redacted reference (no raw images) for dispute evidence.
function ProofForm({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [type, setType] = useState<'photo' | 'code' | 'note'>('photo');
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value.trim()) {
      setError('Add a short reference, code, or note.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await captureProof(tripId, type, value.trim());
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not add proof.');
    } finally {
      setSubmitting(false);
    }
  }

  const active = PROOF_TYPES.find((p) => p.key === type) ?? PROOF_TYPES[0];

  return (
    <View style={styles.proofForm}>
      <View style={styles.proofTypeRow}>
        {PROOF_TYPES.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.proofTypeBtn, type === p.key && styles.proofTypeBtnActive]}
            onPress={() => setType(p.key)}
            accessibilityRole="button"
          >
            <Text style={[styles.proofTypeBtnText, type === p.key && styles.proofTypeBtnTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={active.placeholder}
        placeholderTextColor={tokens.textSecondary}
        maxLength={500}
        style={styles.proofInput}
        accessibilityLabel="Proof value"
      />
      <Text style={styles.proofHint}>
        Stored as a redacted reference for dispute evidence — don&apos;t paste sensitive personal detail.
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.saveProofBtn, submitting && styles.sendBtnDisabled]}
        onPress={() => { void submit(); }}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? <ActivityIndicator size="small" color={accent} /> : <Text style={styles.sendBtnText}>Save proof</Text>}
      </TouchableOpacity>
    </View>
  );
}

function ProviderTripCard({ trip, busyId, onAdvance }: { trip: TrustTransportProviderTrip; busyId: string | null; onAdvance: (_tripId: string, _next: 'en_route' | 'picked_up' | 'delivered' | 'completed') => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofDone, setProofDone] = useState(false);
  const step = NEXT_STEP[trip.status];
  const route = `${trip.pickupCity ?? '—'} → ${trip.dropoffCity ?? '—'}`;
  const terminal = ['completed', 'cancelled', 'disputed', 'emergency_frozen'].includes(trip.status);

  return (
    <View style={styles.tripCard}>
      <View style={styles.tripCardRow}>
        <Text style={styles.tripRoute}>{route}</Text>
        <View style={styles.tripStatusBadge}>
          <Text style={styles.tripStatusBadgeText}>{tripStatusLabel(trip.status)}</Text>
        </View>
      </View>
      <Text style={styles.tripMeta}>{modeLabel(trip.mode)} · {ttSettlementLabel(trip.priceCurrency, trip.priceAmount)}</Text>
      {step ? (
        <TouchableOpacity
          style={[styles.advanceBtn, busyId !== null && styles.sendBtnDisabled]}
          onPress={() => onAdvance(trip.tripId, step.next)}
          disabled={busyId !== null}
          accessibilityRole="button"
        >
          {busyId === trip.tripId ? <ActivityIndicator size="small" color={accent} /> : <Text style={styles.advanceBtnText}>✓ {step.label}</Text>}
        </TouchableOpacity>
      ) : (
        <Text style={styles.noStepText}>No further action — this trip is {tripStatusLabel(trip.status).toLowerCase()}.</Text>
      )}
      {!terminal ? (
        proofDone ? (
          <Text style={styles.proofDoneText}>Proof saved.</Text>
        ) : proofOpen ? (
          <ProofForm tripId={trip.tripId} onDone={() => { setProofDone(true); setProofOpen(false); }} />
        ) : (
          <TouchableOpacity style={styles.addProofBtn} onPress={() => setProofOpen(true)} accessibilityRole="button">
            <Text style={styles.addProofBtnText}>Add pickup/delivery proof</Text>
          </TouchableOpacity>
        )
      ) : null}
      <TrustTransportChatButton tripId={trip.tripId} />
    </View>
  );
}

// Trips the member is fulfilling, with controls to advance the lifecycle one step at a time. Renders
// nothing until loaded and nothing when the member has no trips, so it stays out of the way otherwise.
function ProviderTripsSection() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TrustTransportProviderTrip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const items = await listProviderTrips();
      setTrips(items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load your trips.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function advance(tripId: string, nextStatus: 'en_route' | 'picked_up' | 'delivered' | 'completed') {
    setBusyId(tripId);
    setError(null);
    try {
      await updateTripStatus(tripId, nextStatus);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update the trip.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading || trips.length === 0) return null;

  return (
    <View style={styles.tripsSection}>
      <Text style={styles.tripsSectionTitle}>Trips you&apos;re helping with</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {trips.map((t) => (
        <ProviderTripCard key={t.tripId} trip={t} busyId={busyId} onAdvance={(id, next) => { void advance(id, next); }} />
      ))}
    </View>
  );
}

// Plain relative age ("just now", "5 min ago", "2 h ago", "3 d ago") from an ISO timestamp.
function postedAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

// The offer form for one available request. Note + proposed amount are both optional; sending resets
// this card to a confirmation state so a member can't double-submit by tapping again.
function OfferForm({ requestId, onSent }: { requestId: string; onSent: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const parsed = Number(amount);
      const proposedAmount = amount.trim().length > 0 && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
      await createOffer(requestId, { note: note.trim() || null, proposedAmount });
      onSent();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send your offer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.offerForm}>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a short note (optional) — e.g. when you can help"
        placeholderTextColor={tokens.textSecondary}
        style={styles.noteInput}
        multiline
        accessibilityLabel="Offer note"
      />
      <TextInput
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
        placeholder="Propose an amount (optional)"
        placeholderTextColor={tokens.textSecondary}
        keyboardType="decimal-pad"
        style={styles.amountInput}
        accessibilityLabel="Proposed amount"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.sendBtn, submitting && styles.sendBtnDisabled]}
        onPress={() => { void submit(); }}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? <ActivityIndicator size="small" color={accent} /> : <Text style={styles.sendBtnText}>Send offer</Text>}
      </TouchableOpacity>
    </View>
  );
}

function HelpCard({ request }: { request: TrustTransportAvailableRequest }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardMode}>{modeLabel(request.mode)}</Text>
        <View style={styles.settleBadge}>
          <Text style={styles.settleBadgeText}>{ttSettlementLabel(request.priceCurrency, request.priceAmount)}</Text>
        </View>
        <Text style={styles.cardAge}>{postedAgo(request.createdAtIso)}</Text>
      </View>
      <Text style={styles.cardNote}>Pickup and drop-off are shared with you only if the requester accepts your offer.</Text>
      {sent ? (
        <Text style={styles.sentText}>Offer sent. You&apos;ll get the trip details if they accept.</Text>
      ) : open ? (
        <OfferForm requestId={request.id} onSent={() => { setSent(true); setOpen(false); }} />
      ) : (
        <TouchableOpacity style={styles.offerBtn} onPress={() => setOpen(true)} accessibilityRole="button">
          <Text style={styles.offerBtnText}>🤝 Make an offer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Discovery model B: browse open requests from the community — mode + settlement + age only, never a
// location, until the requester accepts an offer (the trip then carries the full request).
export function TrustTransportHelpTab() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrustTransportAvailableRequest[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listAvailableRequests(1);
        if (active) setItems(data);
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load open requests.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Help out</Text>
      <Text style={styles.sectionDesc}>
        Open requests from the community you can offer to help with. To protect people&apos;s safety, you
        see only what kind of help is needed and how it&apos;s settled.
      </Text>
      <ProviderTripsSection />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No open requests right now. Check back later.</Text>
        </View>
      ) : (
        items.map((r) => <HelpCard key={r.id} request={r} />)
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, marginBottom: 6 },
  sectionDesc: { fontSize: 13, color: SUBTLE, lineHeight: 19, marginBottom: 16 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 13, color: t.textSecondary, textAlign: 'center' },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: `${accent}08`,
    borderWidth: 1,
    borderColor: `${accent}25`,
    marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMode: { fontSize: 14, fontWeight: '700', color: t.textPrimary },
  settleBadge: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  settleBadgeText: { fontSize: 11, color: t.success, fontWeight: '600' },
  cardAge: { marginLeft: 'auto', fontSize: 11, color: t.textSecondary },
  cardNote: { fontSize: 11, color: SUBTLE, marginTop: 8, lineHeight: 16 },
  sentText: { fontSize: 13, color: accent, fontWeight: '600', marginTop: 10 },
  offerBtn: {
    marginTop: 10,
    padding: 10,
    borderRadius: 9,
    backgroundColor: `${accent}15`,
    borderWidth: 1,
    borderColor: `${accent}30`,
    alignItems: 'center',
  },
  offerBtnText: { fontSize: 13, fontWeight: '600', color: accent },
  offerForm: { marginTop: 10, gap: 8 },
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 8,
    fontSize: 13,
    color: '#E8EAF0',
    padding: 10,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  amountInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 8,
    fontSize: 13,
    color: '#E8EAF0',
    padding: 10,
  },
  errorText: { fontSize: 12, color: t.danger },
  sendBtn: {
    padding: 10,
    borderRadius: 9,
    backgroundColor: `${accent}1F`,
    borderWidth: 1,
    borderColor: `${accent}40`,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 13, fontWeight: '600', color: accent },
  tripsSection: { marginBottom: 20 },
  tripsSectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: SUBTLE, marginBottom: 10 },
  tripCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: `${accent}08`,
    borderWidth: 1,
    borderColor: `${accent}25`,
    marginBottom: 12,
  },
  tripCardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripRoute: { fontSize: 14, fontWeight: '700', color: t.textPrimary, flexShrink: 1 },
  tripStatusBadge: {
    marginLeft: 'auto',
    backgroundColor: `${accent}1A`,
    borderWidth: 1,
    borderColor: `${accent}33`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  tripStatusBadgeText: { fontSize: 12, color: accent, fontWeight: '600' },
  tripMeta: { fontSize: 12, color: SUBTLE, marginTop: 6 },
  advanceBtn: {
    marginTop: 12,
    padding: 10,
    borderRadius: 9,
    backgroundColor: `${accent}1F`,
    borderWidth: 1,
    borderColor: `${accent}40`,
    alignItems: 'center',
  },
  advanceBtnText: { fontSize: 13, fontWeight: '600', color: accent },
  noStepText: { fontSize: 12, color: t.textSecondary, marginTop: 10 },
  addProofBtn: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  addProofBtnText: { fontSize: 12, fontWeight: '600', color: SUBTLE },
  proofDoneText: { marginTop: 10, fontSize: 12, color: accent, fontWeight: '600' },
  proofForm: { marginTop: 10, gap: 8 },
  proofTypeRow: { flexDirection: 'row', gap: 6 },
  proofTypeBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  proofTypeBtnActive: { backgroundColor: `${accent}20`, borderColor: `${accent}40` },
  proofTypeBtnText: { fontSize: 12, fontWeight: '600', color: SUBTLE },
  proofTypeBtnTextActive: { color: accent },
  proofInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 8,
    fontSize: 13,
    color: '#E8EAF0',
    padding: 10,
  },
  proofHint: { fontSize: 11, color: t.textSecondary },
  saveProofBtn: {
    padding: 9,
    borderRadius: 8,
    backgroundColor: `${accent}1F`,
    borderWidth: 1,
    borderColor: `${accent}40`,
    alignItems: 'center',
  },
  });
}
