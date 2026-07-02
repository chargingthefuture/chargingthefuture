import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { listAvailableRequests, createOffer } from './api';
import { ttSettlementLabel, type TrustTransportAvailableRequest } from './types';

const COLOR = '#38BDF8';
const TEXT = '#F9FAFB';
const MUTED = '#6B7280';
const SUBTLE = '#9CA3AF';

function modeLabel(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
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
        placeholderTextColor={MUTED}
        style={styles.noteInput}
        multiline
        accessibilityLabel="Offer note"
      />
      <TextInput
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
        placeholder="Propose an amount (optional)"
        placeholderTextColor={MUTED}
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
        {submitting ? <ActivityIndicator size="small" color={COLOR} /> : <Text style={styles.sendBtnText}>Send offer</Text>}
      </TouchableOpacity>
    </View>
  );
}

function HelpCard({ request }: { request: TrustTransportAvailableRequest }) {
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
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLOR} />
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

const styles = StyleSheet.create({
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 6 },
  sectionDesc: { fontSize: 13, color: SUBTLE, lineHeight: 19, marginBottom: 16 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 13, color: MUTED, textAlign: 'center' },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: `${COLOR}08`,
    borderWidth: 1,
    borderColor: `${COLOR}25`,
    marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMode: { fontSize: 14, fontWeight: '700', color: TEXT },
  settleBadge: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  settleBadgeText: { fontSize: 11, color: '#22C55E', fontWeight: '600' },
  cardAge: { marginLeft: 'auto', fontSize: 11, color: MUTED },
  cardNote: { fontSize: 11, color: SUBTLE, marginTop: 8, lineHeight: 16 },
  sentText: { fontSize: 13, color: COLOR, fontWeight: '600', marginTop: 10 },
  offerBtn: {
    marginTop: 10,
    padding: 10,
    borderRadius: 9,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    alignItems: 'center',
  },
  offerBtnText: { fontSize: 13, fontWeight: '600', color: COLOR },
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
  errorText: { fontSize: 12, color: '#EF4444' },
  sendBtn: {
    padding: 10,
    borderRadius: 9,
    backgroundColor: `${COLOR}1F`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 13, fontWeight: '600', color: COLOR },
});
