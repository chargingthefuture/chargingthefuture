import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { Provider, QuoteHistoryItem } from './api';
import { fetchProviders, fetchQuoteHistory } from './api';
import { FoundationLoading } from './FoundationLoading';
import { FoundationEmpty } from './FoundationEmpty';
import { FoundationProviderCard } from './FoundationProviderCard';
import { FoundationProviderDetail } from './FoundationProviderDetail';

const BG = '#0F1117';
const SURFACE_DARK = '#090B0F';
const TEXT = '#F9FAFB';
const TEXT_DIM = '#9CA3AF';
const SUBTLE = '#6B7280';
const COLOR = '#EF4444';

type Tab = 'browse' | 'quotes';

/**
 * Foundation main screen — mirrors MobileFoundation.tsx mockup.
 * Binds real backend data: providers from /api/foundation/providers/search,
 * quote history from /api/foundation/quotes/history.
 * This is the sole exported screen (the earlier placeholder mock was removed).
 *
 * Omitted (no backing field): trade filter chips, star ratings, price/rate,
 * job count, availability dot, credits badge, platform stats. All are
 * design-mockup fixtures with no real API field.
 */
export function Foundation() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [quotes, setQuotes] = useState<QuoteHistoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [page] = useState(1);
  const [tab, setTab] = useState<Tab>('browse');
  const [selected, setSelected] = useState<Provider | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [searchResult, historyResult] = await Promise.all([
          fetchProviders(query, page),
          fetchQuoteHistory(),
        ]);
        if (!cancelled) {
          setProviders(searchResult.items);
          setQuotes(historyResult.items);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load Foundation.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [query, page]);

  if (selected) {
    return (
      <FoundationProviderDetail
        provider={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (loading) return <FoundationLoading />;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusSignal}>100%</Text>
      </View>

      {/* App header */}
      <View style={styles.appHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoIcon}>&#x1F528;</Text>
          </View>
          <View>
            <Text style={styles.appTitle}>Foundation</Text>
            <Text style={styles.appSubtitle}>Vetted trade providers</Text>
          </View>
        </View>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>Verified &#10003;</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search providers..."
          placeholderTextColor={SUBTLE}
          style={styles.searchInput}
        />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['browse', 'quotes'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'browse' ? 'Browse' : 'Quotes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'browse' ? (
        providers.length === 0 ? (
          <FoundationEmpty />
        ) : (
          <FlatList
            data={providers}
            keyExtractor={(item) => item.profileId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <FoundationProviderCard provider={item} onPress={setSelected} />
            )}
          />
        )
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyQuotes}>
              <Text style={styles.emptyQuotesTitle}>No quotes yet</Text>
              <Text style={styles.emptyQuotesDesc}>Browse providers and request a quote to get started.</Text>
              <TouchableOpacity onPress={() => setTab('browse')} style={styles.browseBtn}>
                <Text style={styles.browseBtnText}>Browse Providers</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.quoteCard}>
              <View style={styles.quoteInfo}>
                <Text style={styles.quoteName}>
                  {item.providerName ?? item.providerId ?? 'Provider'}
                </Text>
                {item.createdAt ? (
                  <Text style={styles.quoteDate}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
              <View style={[
                styles.statusBadge,
                item.status === 'Accepted' ? styles.statusAccepted : styles.statusPending,
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  item.status === 'Accepted' ? styles.statusAcceptedText : styles.statusPendingText,
                ]}>
                  {item.status}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {(['browse', 'quotes'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={styles.navItem}
          >
            <View style={[styles.navIconWrap, tab === t && styles.navIconWrapActive]}>
              <Text style={[styles.navIcon, tab === t && styles.navIconActive]}>
                {t === 'browse' ? '&#128269;' : '&#128196;'}
              </Text>
            </View>
            <Text style={[styles.navLabel, tab === t && styles.navLabelActive]}>
              {t === 'browse' ? 'Browse' : 'Quotes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: COLOR,
    fontSize: 15,
    textAlign: 'center',
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
  appHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: SURFACE_DARK,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 18,
    color: COLOR,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
  },
  appSubtitle: {
    fontSize: 11,
    color: COLOR,
  },
  verifiedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}35`,
  },
  verifiedText: {
    fontSize: 11,
    color: COLOR,
    fontWeight: '600',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: SURFACE_DARK,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: TEXT,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: SURFACE_DARK,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabBtnActive: {
    backgroundColor: `${COLOR}20`,
    borderColor: `${COLOR}50`,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SUBTLE,
  },
  tabLabelActive: {
    color: COLOR,
  },
  list: {
    padding: 16,
  },
  emptyQuotes: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyQuotesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DIM,
    marginBottom: 8,
  },
  emptyQuotesDesc: {
    fontSize: 13,
    color: SUBTLE,
    textAlign: 'center',
    marginBottom: 16,
  },
  browseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
  },
  browseBtnText: {
    color: COLOR,
    fontSize: 13,
    fontWeight: '600',
  },
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: `${COLOR}20`,
    marginBottom: 10,
  },
  quoteInfo: {
    flex: 1,
  },
  quoteName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 2,
  },
  quoteDate: {
    fontSize: 12,
    color: TEXT_DIM,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusAccepted: {
    backgroundColor: '#22C55E20',
    borderColor: '#22C55E40',
  },
  statusPending: {
    backgroundColor: `${COLOR}15`,
    borderColor: `${COLOR}30`,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusAcceptedText: {
    color: '#22C55E',
  },
  statusPendingText: {
    color: COLOR,
  },
  bottomNav: {
    height: 72,
    backgroundColor: SURFACE_DARK,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapActive: {
    backgroundColor: `${COLOR}20`,
  },
  navIcon: {
    fontSize: 18,
    color: SUBTLE,
  },
  navIconActive: {
    color: COLOR,
  },
  navLabel: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '400',
  },
  navLabelActive: {
    color: COLOR,
    fontWeight: '600',
  },
});
