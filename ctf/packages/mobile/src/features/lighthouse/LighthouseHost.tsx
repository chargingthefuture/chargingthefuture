import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/auth-context';
import { fetchMyProperties, createProperty } from './api';
import type { LighthouseProperty, PropertyCreateInput } from './types';
import { fetchCurrencies } from '../currency/api';
import { buildCurrencyMap, formatRentParts, type CurrencyMap } from './currency';
import { LighthouseHostForm } from './LighthouseHostForm';

// Compact inline rent string for the "Your listings" rows, e.g. "20 ServiceCredits/mo" or "$1,200/mo".
function inlineRent(property: LighthouseProperty, currencies: CurrencyMap): string {
  const parts = formatRentParts(property, currencies);
  if (!parts) return 'ServiceCredits / free';
  return `${parts.primary}${parts.unit ? ` ${parts.unit}` : ''}${parts.perMonth ? '/mo' : ''}`;
}

// Member self-service hosting. A member lists their own place here; there is NO
// separate "host profile" form — the host identity shown on a listing is composed
// from data we already have (username + Quora link). Mirrors the web surface at
// ctf/packages/web/components/lighthouse/lighthouse-host.tsx.

const COLOR = '#60A5FA';
const BG = '#0F1117';
const SURFACE = 'rgba(255,255,255,0.02)';
const BORDER = `${COLOR}20`;
const MUTED = '#9CA3AF';

export const LighthouseHost: React.FC = () => {
  const { user } = useAuth();
  const username = user?.username ?? null;

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<LighthouseProperty[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyMap>({});
  const [quoraUrl, setQuoraUrl] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    try {
      const data = await fetchMyProperties();
      setProperties(data.items ?? []);
      setQuoraUrl(data.host?.quoraProfileUrl ?? null);
    } catch {
      // Best-effort; the create form still works without the list.
      setProperties([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    // Best-effort currency catalog so the listing rows render rent in its own currency.
    fetchCurrencies()
      .then((rows) => {
        if (mounted) setCurrencies(buildCurrencyMap(rows));
      })
      .catch(() => undefined);
    loadMine().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [loadMine]);

  const handleSubmit = useCallback(
    async (input: PropertyCreateInput) => {
      if (!input.title.trim() || !input.description.trim()) {
        setError('Title and description are required.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await createProperty(input);
        setShowForm(false);
        await loadMine();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create the listing. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [loadMine],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Host identity — composed from existing data, nothing to re-enter. */}
      <View style={styles.identityCard}>
        <Text style={styles.identityLabel}>You are listing as</Text>
        <View style={styles.identityRow}>
          <Text style={styles.identityName}>{username ? `@${username}` : 'Your account'}</Text>
          {quoraUrl ? (
            <View style={styles.quoraBadge}>
              <Text style={styles.quoraText}>Quora profile</Text>
              <Ionicons name="open-outline" size={12} color={COLOR} />
            </View>
          ) : null}
        </View>
        <Text style={styles.identityHint}>
          Seekers see your name, your Quora profile, and your Trust signals — you do not create a separate host profile.
        </Text>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Your listings ({properties.length})</Text>
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => {
            setShowForm((v) => !v);
            setError(null);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={16} color={COLOR} />
          <Text style={styles.toggleBtnText}>{showForm ? 'Close' : 'List your place'}</Text>
        </TouchableOpacity>
      </View>

      {showForm ? <LighthouseHostForm submitting={submitting} error={error} onSubmit={handleSubmit} /> : null}

      {properties.length === 0 ? (
        <Text style={styles.emptyText}>You have no listings yet. Tap “List your place” to add one.</Text>
      ) : (
        <View style={styles.listingList}>
          {properties.map((p) => (
            <View key={p.id} style={styles.listingCard}>
              <Text style={styles.listingTitle}>{p.title}</Text>
              <Text style={styles.listingMeta}>
                {[p.city, p.state].filter(Boolean).join(', ') || 'Location not set'}
                {` · ${inlineRent(p, currencies)}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  identityCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  identityLabel: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 6,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  identityName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  quoraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoraText: {
    fontSize: 12,
    color: COLOR,
  },
  identityHint: {
    fontSize: 12,
    color: MUTED,
    marginTop: 6,
    lineHeight: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    flexShrink: 1,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: `${COLOR}1A`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR,
  },
  emptyText: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    paddingVertical: 24,
  },
  listingList: {
    gap: 10,
  },
  listingCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  listingMeta: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },
});
