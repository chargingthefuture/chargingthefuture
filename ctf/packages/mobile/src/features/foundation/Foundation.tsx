import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { OfferableSkill, Provider, QuoteHistoryItem } from './api';
import {
  fetchProviders,
  fetchQuoteHistory,
  fetchOfferableSkills,
  setOfferedSkills,
} from './api';
import { FoundationLoading } from './FoundationLoading';
import { FoundationEmpty } from './FoundationEmpty';
import { FoundationProviderCard } from './FoundationProviderCard';
import { FoundationProviderDetail } from './FoundationProviderDetail';
import { FoundationDirectLine } from './FoundationDirectLine';

const BG = '#0F1117';
const SURFACE_DARK = '#090B0F';
const TEXT = '#F9FAFB';
const TEXT_DIM = '#9CA3AF';
const SUBTLE = '#6B7280';
const COLOR = '#F59E0B';

type Tab = 'browse' | 'quotes' | 'offer';

const TAB_LABEL: Record<Tab, string> = {
  browse: 'Browse',
  quotes: 'Quotes',
  offer: 'Offer skills',
};

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
  // The signed-in viewer's own user id, returned by the provider search. Used to
  // suppress "Connect now" on the viewer's own provider card (issue #808).
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteHistoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [page] = useState(1);
  const [tab, setTab] = useState<Tab>('browse');
  const [selected, setSelected] = useState<Provider | null>(null);
  // The Direct Line currently open (the 1:1 chat for one connection thread), or null. Opened straight
  // after a Request Quote and re-opened from a Quotes row. `subtitle` is who the conversation is with.
  const [directLine, setDirectLine] = useState<{ threadId: string; subtitle: string | null } | null>(null);
  // Bumped to re-run the providers + quotes load (e.g. after a new quote request, so the new quote
  // appears in the Quotes list when the member backs out of the Direct Line).
  const [reloadKey, setReloadKey] = useState(0);
  // Active skill filter on the browse list (tapped from a provider's offered-skill chip).
  const [skillFilter, setSkillFilter] = useState<{ id: string; name: string } | null>(null);
  // "Offer skills" surface state.
  const [offerSkills, setOfferSkills] = useState<OfferableSkill[]>([]);
  const [offerSelected, setOfferSelected] = useState<Set<string>>(new Set());
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSavedMsg, setOfferSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [searchResult, historyResult] = await Promise.all([
          fetchProviders(query, page, skillFilter?.id ?? null),
          fetchQuoteHistory(),
        ]);
        if (!cancelled) {
          setProviders(searchResult.items);
          setViewerUserId(searchResult.viewerUserId ?? null);
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
  }, [query, page, skillFilter, reloadKey]);

  // Load the member's own Directory skills (with their offered flag) when the Offer-skills tab opens.
  useEffect(() => {
    if (tab !== 'offer') return;
    let cancelled = false;
    setOfferLoading(true);
    setOfferError(null);
    setOfferSavedMsg(null);
    fetchOfferableSkills()
      .then((skills) => {
        if (cancelled) return;
        setOfferSkills(skills);
        setOfferSelected(new Set(skills.filter((s) => s.offered).map((s) => s.id)));
      })
      .catch((e: unknown) => {
        if (!cancelled) setOfferError(e instanceof Error ? e.message : 'Unable to load your skills.');
      })
      .finally(() => {
        if (!cancelled) setOfferLoading(false);
      });
    return () => { cancelled = true; };
  }, [tab]);

  const onFilterSkill = (skillId: string, name: string) => {
    setSkillFilter({ id: skillId, name });
    setTab('browse');
  };

  const toggleOffer = (id: string) => {
    setOfferSavedMsg(null);
    setOfferSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveOffers = async () => {
    setOfferSaving(true);
    setOfferError(null);
    setOfferSavedMsg(null);
    try {
      const accepted = await setOfferedSkills(Array.from(offerSelected));
      setOfferSelected(new Set(accepted));
      setOfferSavedMsg('Saved. These are the skills people can contact you about.');
    } catch (e: unknown) {
      setOfferError(e instanceof Error ? e.message : 'Unable to save your offered skills.');
    } finally {
      setOfferSaving(false);
    }
  };

  // The Direct Line (1:1 chat for a connection thread) takes precedence over every other surface while
  // it is open. Opened straight after a Request Quote and re-opened from a Quotes row.
  if (directLine) {
    return (
      <FoundationDirectLine
        threadId={directLine.threadId}
        subtitle={directLine.subtitle}
        onBack={() => {
          setDirectLine(null);
          setSelected(null);
          setTab('quotes');
          // Refresh so a just-requested quote shows in the Quotes list.
          setReloadKey((key) => key + 1);
        }}
      />
    );
  }

  if (selected) {
    return (
      <FoundationProviderDetail
        provider={selected}
        viewerUserId={viewerUserId}
        onBack={() => setSelected(null)}
        onOpenDirectLine={(threadId, subtitle) => setDirectLine({ threadId, subtitle })}
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
            <Text style={styles.appSubtitle}>Community trade providers</Text>
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
        {(['browse', 'quotes', 'offer'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {TAB_LABEL[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'browse' ? (
        <View style={styles.browseWrap}>
          {skillFilter ? (
            <View style={styles.filterBar}>
              <Text style={styles.filterLabel} numberOfLines={1}>
                Offering: {skillFilter.name}
              </Text>
              <Pressable
                style={styles.filterClear}
                onPress={() => setSkillFilter(null)}
                accessibilityRole="button"
                accessibilityLabel="Clear skill filter"
              >
                <Text style={styles.filterClearText}>Clear ×</Text>
              </Pressable>
            </View>
          ) : null}
          {providers.length === 0 ? (
            <FoundationEmpty />
          ) : (
            <FlatList
              data={providers}
              keyExtractor={(item) => item.profileId}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <FoundationProviderCard provider={item} onPress={setSelected} onFilterSkill={onFilterSkill} />
              )}
            />
          )}
        </View>
      ) : tab === 'offer' ? (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.offerIntro}>
            Choose which of your Directory skills you&#39;re willing to be contacted about through
            Foundation. Only the skills you turn on appear on your provider card.
          </Text>
          {offerLoading ? (
            <ActivityIndicator color={COLOR} style={styles.offerSpinner} />
          ) : offerError ? (
            <Text style={styles.offerError}>{offerError}</Text>
          ) : offerSkills.length === 0 ? (
            <Text style={styles.offerEmpty}>
              You have no Directory skills yet. Add skills to your Directory profile first, then come
              back to offer them here.
            </Text>
          ) : (
            <>
              <View style={styles.offerChipWrap}>
                {offerSkills.map((skill) => {
                  const on = offerSelected.has(skill.id);
                  return (
                    <Pressable
                      key={skill.id}
                      style={[styles.offerChip, on ? styles.offerChipOn : null]}
                      onPress={() => toggleOffer(skill.id)}
                    >
                      <Text style={[styles.offerChipText, on ? styles.offerChipTextOn : null]}>
                        {on ? '✓ ' : ''}{skill.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {offerSavedMsg ? <Text style={styles.offerSaved}>{offerSavedMsg}</Text> : null}
              <TouchableOpacity
                style={[styles.offerSaveBtn, offerSaving ? styles.offerSaveBtnBusy : null]}
                onPress={() => { void saveOffers(); }}
                disabled={offerSaving}
              >
                {offerSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.offerSaveText}>Save offered skills</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
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
          renderItem={({ item }) => {
            const name = item.providerName ?? item.providerId ?? 'Provider';
            // Only rows that carry a thread id can re-open a Direct Line (the chat is keyed by thread).
            const canOpen = Boolean(item.threadId);
            const body = (
              <>
                <View style={styles.quoteInfo}>
                  <Text style={styles.quoteName}>{name}</Text>
                  {item.createdAt ? (
                    <Text style={styles.quoteDate}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  ) : null}
                  {canOpen ? <Text style={styles.quoteOpenHint}>Open Direct Line ›</Text> : null}
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
              </>
            );
            if (canOpen && item.threadId) {
              const threadId = item.threadId;
              return (
                <TouchableOpacity
                  style={styles.quoteCard}
                  onPress={() => setDirectLine({ threadId, subtitle: item.providerName ?? null })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Direct Line with ${name}`}
                >
                  {body}
                </TouchableOpacity>
              );
            }
            return <View style={styles.quoteCard}>{body}</View>;
          }}
        />
      )}

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {(['browse', 'quotes', 'offer'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={styles.navItem}
          >
            <View style={[styles.navIconWrap, tab === t && styles.navIconWrapActive]}>
              <Text style={[styles.navIcon, tab === t && styles.navIconActive]}>
                {t === 'browse' ? '🔍' : t === 'quotes' ? '📄' : '🛠'}
              </Text>
            </View>
            <Text style={[styles.navLabel, tab === t && styles.navLabelActive]}>
              {TAB_LABEL[t]}
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
  browseWrap: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}35`,
  },
  filterLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLOR,
  },
  filterClear: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  filterClearText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR,
  },
  offerIntro: {
    fontSize: 13,
    color: TEXT_DIM,
    lineHeight: 20,
    marginBottom: 14,
  },
  offerSpinner: {
    marginTop: 20,
  },
  offerError: {
    fontSize: 13,
    color: COLOR,
    marginTop: 8,
  },
  offerEmpty: {
    fontSize: 13,
    color: SUBTLE,
    lineHeight: 20,
    marginTop: 8,
  },
  offerChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  offerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  offerChipOn: {
    backgroundColor: `${COLOR}20`,
    borderColor: `${COLOR}55`,
  },
  offerChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: SUBTLE,
  },
  offerChipTextOn: {
    color: COLOR,
  },
  offerSaved: {
    fontSize: 12,
    color: '#22C55E',
    marginBottom: 12,
  },
  offerSaveBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLOR,
    alignItems: 'center',
  },
  offerSaveBtnBusy: {
    opacity: 0.6,
  },
  offerSaveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
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
  quoteOpenHint: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR,
    marginTop: 4,
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
