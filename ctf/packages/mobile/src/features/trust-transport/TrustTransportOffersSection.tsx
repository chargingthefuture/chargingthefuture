import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import { listOffersForRequest, acceptOffer } from './api';
import type { TrustTransportOffer } from './types';

// Left raw by design: SUBTLE (#9CA3AF) has no exact-value mobile token equivalent.
const SUBTLE = '#9CA3AF';

// Offers on one of the caller's own open requests, with Accept. Accepting opens a trip and (per
// discovery model B) is the point at which the chosen provider gains the pickup/drop-off via the trip.
export function TrustTransportOffersSection({ requestId, onAccepted }: { requestId: string; onAccepted: () => void }) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('trust-transport', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<TrustTransportOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const items = await listOffersForRequest(requestId);
      setOffers(items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load offers.');
    } finally {
      setLoading(false);
    }
  }

  async function accept(offerId: string) {
    setAcceptingId(offerId);
    setError(null);
    try {
      await acceptOffer(requestId, offerId);
      onAccepted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not accept this offer.');
    } finally {
      setAcceptingId(null);
    }
  }

  if (!open) {
    return (
      <TouchableOpacity style={styles.viewBtn} onPress={() => { void load(); }} accessibilityRole="button">
        <Text style={styles.viewBtnText}>View offers</Text>
      </TouchableOpacity>
    );
  }

  const pending = offers.filter((o) => o.status === 'pending');

  return (
    <View style={styles.section}>
      {loading ? (
        <ActivityIndicator size="small" color={accent} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : pending.length === 0 ? (
        <Text style={styles.emptyText}>No offers yet. You&apos;ll see them here as people offer to help.</Text>
      ) : (
        pending.map((offer) => (
          <View key={offer.id} style={styles.offerCard}>
            <Text style={styles.offerText}>
              A community member{offer.proposedAmount != null ? ` · proposes ${offer.proposedAmount}` : ''}
            </Text>
            {offer.note ? <Text style={styles.offerNote}>{offer.note}</Text> : null}
            <TouchableOpacity
              style={[styles.acceptBtn, acceptingId !== null && styles.acceptBtnDisabled]}
              onPress={() => { void accept(offer.id); }}
              disabled={acceptingId !== null}
              accessibilityRole="button"
            >
              {acceptingId === offer.id ? <ActivityIndicator size="small" color={accent} /> : <Text style={styles.acceptBtnText}>✓ Accept offer</Text>}
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  viewBtn: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  viewBtnText: { fontSize: 12, fontWeight: '600', color: SUBTLE },
  section: { marginTop: 10, gap: 8 },
  errorText: { fontSize: 12, color: t.danger },
  emptyText: { fontSize: 12, color: t.textSecondary },
  offerCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  offerText: { fontSize: 13, color: t.textPrimary, fontWeight: '600' },
  offerNote: { fontSize: 12, color: SUBTLE, marginTop: 4, lineHeight: 17 },
  acceptBtn: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: `${accent}1F`,
    borderWidth: 1,
    borderColor: `${accent}40`,
    alignItems: 'center',
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { fontSize: 12, fontWeight: '600', color: accent },
  });
}
