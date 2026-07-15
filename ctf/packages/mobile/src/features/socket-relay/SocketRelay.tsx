import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  createRequest,
  listMyRequests,
  listRequests,
  fulfillRequest,
  repostRequest,
  socketRelayHandle,
  settlementLabel,
  updateRequest,
  type SocketRelayError,
  type SocketRelayRequest,
} from './api';
import { deriveTagChips, requestTags, suggestTags } from './tags';
import { SocketRelayTagInput } from './SocketRelayTagInput';
import { SocketRelayLoading } from './SocketRelayLoading';
import { SocketRelayEmpty } from './SocketRelayEmpty';
import { SocketRelayDirectLines } from './SocketRelayDirectLines';
import { CurrencySelect } from '../currency';
import type { Currency } from '../currency';
import { useAuth } from '../../auth/auth-context';
import { ShareLink } from '../../components/shared/ShareLink';
import { getApiBaseUrl } from '../../auth/authedFetch';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

// Absolute deep link to one request, the destination a shared ShareLink points at. Mirrors the web
// feed's share target (/apps/socket-relay?request=<id>). Built from the same APP_URL the API calls
// resolve against; returns null if it is unset so the card renders no share control rather than crash.
function requestShareUrl(requestId: string): string | null {
  try {
    return `${getApiBaseUrl()}/apps/socket-relay?request=${encodeURIComponent(requestId)}`;
  } catch {
    return null;
  }
}

// Note: need/offer distinction, urgency, and credits are not in the
// SocketRelayRequest model (title/details/tags/city/status only).
// Those mockup UI elements are omitted per real-data-only policy.

type NavKey = 'feed' | 'post' | 'lines';

export function SocketRelay() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('socket-relay', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [activeNav, setActiveNav] = useState<NavKey>('feed');
  const [requests, setRequests] = useState<SocketRelayRequest[]>([]);
  const [myRequestIds, setMyRequestIds] = useState<string[]>([]);
  const [myRequestsFailed, setMyRequestsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [helped, setHelped] = useState<string[]>([]);
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [reposting, setReposting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  // Post form state (doubles as the edit form when editingId is set)
  const [postTitle, setPostTitle] = useState('');
  const [postDetails, setPostDetails] = useState('');
  const [postTags, setPostTags] = useState<string[]>([]);
  const [postCity, setPostCity] = useState('');
  // How the request is settled (issue #420): default Free (mutual aid); amount only for priced types.
  const [postPriceCurrency, setPostPriceCurrency] = useState('FREE');
  const [postPriceAmount, setPostPriceAmount] = useState('');
  const [postRequiresAmount, setPostRequiresAmount] = useState(false);
  // SocketRelay is community-only — there is no "make public" option. Requests are members-only.
  const [postIsPublic, setPostIsPublic] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // background=true (pull-to-refresh) re-pulls without flashing the full loading state.
  const loadFeed = useCallback((background = false) => {
    if (!background) setLoading(true);
    setError(null);
    return Promise.all([
      listRequests(),
      // Ownership is derived from the my-requests list; ignore its failure so
      // the public feed still renders.
      listMyRequests().catch(() => null),
    ])
      .then(([feed, mine]) => {
        setRequests(feed.items);
        setMyRequestIds(mine ? mine.items.map((r) => r.id) : []);
        // Track the my-requests failure so the feed can fall back to showing expired posts. Without
        // this, a failed my-requests load leaves myRequestIds empty and every expired post is hidden —
        // including the owner's own, locking them out of the re-post affordance on their own posts.
        setMyRequestsFailed(mine === null);
      })
      .catch(() => setError('Failed to load requests.'))
      .finally(() => {
        if (!background) setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (activeNav === 'feed') {
      loadFeed();
    }
  }, [activeNav, loadFeed]);

  // Pull-to-refresh: re-pull the feed without flashing the full loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFeed(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadFeed]);

  const handleFulfill = async (requestId: string) => {
    if (helped.includes(requestId) || fulfilling === requestId) return;
    setFulfilling(requestId);
    try {
      await fulfillRequest(requestId);
      setHelped((prev) => [...prev, requestId]);
    } catch (e) {
      // If the post expired between loading the feed and claiming it, the server rejects with a
      // 409 request_expired; reload so the now-inactive post drops out of the feed. Other failures
      // are ignored so the optimistic UI is not rolled back with a flash.
      if ((e as SocketRelayError)?.code === 'request_expired') {
        loadFeed();
      }
    } finally {
      setFulfilling(null);
    }
  };

  // Re-post an expired request the member owns: resets the 28-day clock server-side and swaps the
  // refreshed (now-active) request into the feed in place, with no full-screen reload.
  const handleRepost = async (requestId: string) => {
    if (reposting) return;
    setReposting(requestId);
    try {
      const updated = await repostRequest(requestId);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      // Leave the card in its expired state; the owner can try again.
    } finally {
      setReposting(null);
    }
  };

  // A priced value type (ServiceCredits, fiat, crypto) needs a positive amount; Free/Barter don't.
  const parsedPostPriceAmount = Number(postPriceAmount);
  const hasValidPostAmount =
    !postRequiresAmount || (Number.isFinite(parsedPostPriceAmount) && parsedPostPriceAmount > 0);

  const resetPostForm = () => {
    setPostTitle('');
    setPostDetails('');
    setPostTags([]);
    setPostCity('');
    setPostIsPublic(false);
    setEditingId(null);
    setPostPriceCurrency('FREE');
    setPostPriceAmount('');
    setPostRequiresAmount(false);
    setPostError(null);
  };

  const startEdit = (r: SocketRelayRequest) => {
    setPostTitle(r.title);
    setPostDetails(r.details);
    setPostTags(requestTags(r));
    setPostCity(r.city ?? '');
    setPostIsPublic(r.isPublic);
    setEditingId(r.id);
    setPostPriceCurrency(r.priceCurrency ?? 'FREE');
    setPostPriceAmount(r.priceAmount != null ? String(r.priceAmount) : '');
    setPostRequiresAmount(r.priceAmount != null);
    setPostError(null);
    setActiveNav('post');
  };

  const handlePost = async () => {
    if (!postTitle.trim() || postTags.length === 0) return;
    if (!hasValidPostAmount) {
      setPostError('Enter an amount greater than zero for this value type.');
      return;
    }
    setPosting(true);
    setPostError(null);
    try {
      const input = {
        title: postTitle.trim().slice(0, 80),
        details: postDetails.trim(),
        tags: postTags,
        city: postCity.trim() || null,
        isPublic: postIsPublic,
        priceCurrency: postPriceCurrency || null,
        priceAmount: postRequiresAmount ? parsedPostPriceAmount : null,
      };
      if (editingId) {
        await updateRequest(editingId, input);
      } else {
        await createRequest(input);
      }
      resetPostForm();
      // Switching back to the feed re-runs loadFeed via the activeNav effect.
      setActiveNav('feed');
    } catch {
      setPostError(
        editingId
          ? 'Failed to save changes. Please try again.'
          : 'Failed to post request. Please try again.',
      );
    } finally {
      setPosting(false);
    }
  };

  const renderFeed = () => {
    if (loading) {
      return <SocketRelayLoading />;
    }
    if (error) {
      return (
        <View style={styles.centeredMsg}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadFeed()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (requests.length === 0) {
      return (
        <SocketRelayEmpty
          onPostNeed={() => setActiveNav('post')}
          onOfferHelp={() => setActiveNav('post')}
        />
      );
    }
    const visible = requests.filter((r) => {
      // Expired posts are inactive: hide everyone else's. The member's own expired posts stay so
      // they can be re-posted from their card. If the my-requests load failed we can't tell which are
      // the member's own, so we keep all expired posts rather than risk hiding the owner's — never lock
      // someone out of re-posting their own request over a transient fetch failure.
      if (r.isExpired && !myRequestsFailed && !myRequestIds.includes(r.id)) return false;
      if (
        tagFilter !== 'All' &&
        !requestTags(r).some((t) => t.toLowerCase() === tagFilter.toLowerCase())
      ) {
        return false;
      }
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${r.title} ${r.details} ${r.city ?? ''}`.toLowerCase().includes(q);
    });
    return (
      <ScrollView
        style={styles.feedScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        <View style={styles.feedPad}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search requests…"
            placeholderTextColor={tokens.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagChipRow}
          >
            {deriveTagChips(requests, tagFilter).map((tag) => {
              const active = tag.toLowerCase() === tagFilter.toLowerCase();
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, active && styles.tagChipActive]}
                  onPress={() => setTagFilter(tag)}
                >
                  <Text
                    style={[styles.tagChipText, active && styles.tagChipTextActive]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {visible.map((r) => (
            <React.Fragment key={r.id}>
              <View style={styles.card}>
                {/* Tag badges */}
                <View style={styles.cardBadgeRow}>
                  {requestTags(r).map((tag) => (
                    <View key={tag} style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{tag}</Text>
                    </View>
                  ))}
                  <View style={styles.settleBadge}>
                    <Text style={styles.settleBadgeText}>{settlementLabel(r.priceCurrency, r.priceAmount)}</Text>
                  </View>
                  {r.status !== 'open' && (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{r.status}</Text>
                    </View>
                  )}
                  {r.isExpired && (
                    <View style={styles.expiredBadge}>
                      <Text style={styles.expiredBadgeText}>Expired</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardTitle}>{r.title}</Text>

                {/* details — omit if blank */}
                {r.details ? (
                  <Text style={styles.cardDetails} numberOfLines={2}>
                    {r.details}
                  </Text>
                ) : null}

                <Text style={styles.cardPoster}>
                  {socketRelayHandle(r.ownerUsername, r.id)}
                </Text>

                <Text style={styles.cardMeta}>
                  {r.city ? `📍 ${r.city} · ` : ''}
                  {new Date(r.createdAtIso).toLocaleDateString()}
                </Text>

                {/* Share this request — the one app-wide control (rule 130), matching the web feed.
                    The link opens SocketRelay (auth-gated) on the destination device. */}
                {(() => {
                  const shareUrl = requestShareUrl(r.id);
                  return shareUrl ? (
                    <View style={styles.cardShareRow}>
                      <ShareLink url={shareUrl} title="Share this request" color={accent} />
                    </View>
                  ) : null;
                })()}

                {myRequestIds.includes(r.id) ? (
                  r.isExpired ? (
                    <>
                      <TouchableOpacity
                        style={styles.repostBtn}
                        onPress={() => handleRepost(r.id)}
                        disabled={reposting === r.id}
                      >
                        {reposting === r.id ? (
                          <ActivityIndicator size="small" color={accent} />
                        ) : (
                          <Text style={styles.repostBtnText}>Re-post</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(r)}>
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => startEdit(r)}
                      disabled={r.status !== 'open'}
                    >
                      <Text style={styles.editBtnText}>
                        {r.status === 'open' ? 'Edit Your Request' : 'Your request'}
                      </Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.helpBtn,
                      helped.includes(r.id) && styles.helpBtnDone,
                    ]}
                    onPress={() => handleFulfill(r.id)}
                    disabled={
                      helped.includes(r.id) ||
                      fulfilling === r.id ||
                      r.status !== 'open' ||
                      r.isExpired
                    }
                  >
                    {fulfilling === r.id ? (
                      <ActivityIndicator size="small" color={accent} />
                    ) : (
                      <Text
                        style={[
                          styles.helpBtnText,
                          helped.includes(r.id) && styles.helpBtnTextDone,
                        ]}
                      >
                        {helped.includes(r.id)
                          ? '✓ Fulfilled'
                          : r.isExpired
                            ? 'Expired'
                            : r.status === 'open'
                              ? 'I Can Help'
                              : 'Closed'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderPost = () => (
    <ScrollView
      style={styles.feedScroll}
      contentContainerStyle={styles.feedPad}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.postHeading}>
        {editingId ? 'Edit Your Request' : 'Post a Request or Offer'}
      </Text>

      <TextInput
        style={styles.textArea}
        placeholder="Title — what do you need or offer? (80 chars)"
        placeholderTextColor={tokens.textMuted}
        value={postTitle}
        onChangeText={setPostTitle}
        maxLength={80}
      />
      <TextInput
        style={styles.textArea}
        placeholder="Details (optional)"
        placeholderTextColor={tokens.textMuted}
        value={postDetails}
        onChangeText={setPostDetails}
        multiline
        numberOfLines={3}
      />
      <SocketRelayTagInput
        tags={postTags}
        onChange={setPostTags}
        suggest={(prefix, exclude) => suggestTags(requests, prefix, exclude)}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Location (neighbourhood only, optional)"
        placeholderTextColor={tokens.textMuted}
        value={postCity}
        onChangeText={setPostCity}
      />

      <Text style={styles.settleLabel}>How will this be settled?</Text>
      <CurrencySelect
        value={postPriceCurrency}
        onChange={(code, currency: Currency | null) => {
          const needsAmount = currency?.requiresAmount ?? false;
          setPostPriceCurrency(code);
          setPostRequiresAmount(needsAmount);
          if (!needsAmount) setPostPriceAmount('');
        }}
      />
      {postRequiresAmount ? (
        <TextInput
          style={styles.textInput}
          placeholder="Amount (e.g. 20)"
          placeholderTextColor={tokens.textMuted}
          value={postPriceAmount}
          onChangeText={(t) => setPostPriceAmount(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
        />
      ) : null}

      {postError ? (
        <Text style={styles.errorText}>{postError}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.postBtn, (!postTitle.trim() || postTags.length === 0 || !hasValidPostAmount) && styles.postBtnDisabled]}
        onPress={handlePost}
        disabled={posting || !postTitle.trim() || postTags.length === 0 || !hasValidPostAmount}
      >
        {posting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.postBtnText}>
            {editingId ? 'Save Changes' : 'Post My Request'}
          </Text>
        )}
      </TouchableOpacity>

      {editingId ? (
        <TouchableOpacity
          style={styles.cancelEditBtn}
          onPress={() => {
            resetPostForm();
            setActiveNav('feed');
          }}
          disabled={posting}
        >
          <Text style={styles.cancelEditBtnText}>Cancel Edit</Text>
        </TouchableOpacity>
      ) : null}

      {/* Privacy notice — from mockup Shield element */}
      <View style={styles.privacyNotice}>
        <Text style={styles.privacyTitle}>🛡 Privacy Minimized</Text>
        <Text style={styles.privacyBody}>
          Never includes identifying info.
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconGlyph}>↗</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>SocketRelay</Text>
            <Text style={styles.headerSubtitle}>Mutual aid</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => setActiveNav('post')}
          accessibilityRole="button"
          accessibilityLabel="Add request"
        >
          <Text style={styles.headerAddBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {activeNav === 'feed'
          ? renderFeed()
          : activeNav === 'lines'
            ? <SocketRelayDirectLines currentUserId={currentUserId} />
            : renderPost()}
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {(['feed', 'lines', 'post'] as NavKey[]).map((key) => {
          const label = key === 'feed' ? 'Feed' : key === 'lines' ? 'Lines' : 'Post';
          const icon = key === 'feed' ? '↗' : key === 'lines' ? '💬' : '+';
          const active = activeNav === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.navItem}
              onPress={() => setActiveNav(key)}
            >
              <View
                style={[styles.navIconBox, active && styles.navIconBoxActive]}
              >
                <Text
                  style={[styles.navIcon, active && styles.navIconActive]}
                >
                  {icon}
                </Text>
              </View>
              <Text
                style={[styles.navLabel, active && styles.navLabelActive]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
    paddingTop: Platform.OS === 'android' ? 32 : 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: t.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: t.borderFaint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerIconGlyph: { fontSize: 18, color: accent },
  headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
  headerSubtitle: { fontSize: 11, color: accent },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddBtnText: { fontSize: 20, color: '#fff', fontWeight: '700' },
  body: { flex: 1 },
  feedScroll: { flex: 1 },
  feedPad: { padding: 16 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: t.textShell,
    marginBottom: 10,
  },
  tagChipRow: { marginBottom: 12, flexGrow: 0 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: 6,
  },
  tagChipActive: {
    backgroundColor: `${accent}15`,
    borderColor: `${accent}50`,
  },
  tagChipText: { fontSize: 12, fontWeight: '600', color: t.textSecondary },
  tagChipTextActive: { color: accent },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: `${accent}30`,
    marginBottom: 10,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: t.borderFaint,
  },
  categoryBadgeText: { fontSize: 10, color: t.textSecondary },
  settleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  settleBadgeText: { fontSize: 10, color: '#22C55E' },
  settleLabel: { fontSize: 12, color: t.textSecondary, marginTop: 4, marginBottom: 6 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusBadgeText: { fontSize: 10, color: t.textSecondary },
  expiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(244,63,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.30)',
  },
  expiredBadgeText: { fontSize: 10, color: '#F43F5E', fontWeight: '600' },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: t.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  cardDetails: { fontSize: 12, color: t.textSecondary, marginBottom: 6, lineHeight: 18 },
  cardPoster: { fontSize: 12, color: accent, fontWeight: '600', marginBottom: 4 },
  cardMeta: { fontSize: 11, color: t.textSecondary, marginBottom: 10 },
  cardShareRow: { flexDirection: 'row', marginBottom: 10 },
  helpBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${accent}15`,
    borderWidth: 1,
    borderColor: `${accent}30`,
    alignItems: 'center',
  },
  helpBtnDone: {
    backgroundColor: `${t.success}20`,
    borderColor: `${t.success}40`,
  },
  helpBtnText: { fontSize: 12, fontWeight: '700', color: accent },
  helpBtnTextDone: { color: t.success },
  editBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: t.textSecondary },
  repostBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${accent}15`,
    borderWidth: 1,
    borderColor: `${accent}30`,
    alignItems: 'center',
    marginBottom: 8,
  },
  repostBtnText: { fontSize: 12, fontWeight: '700', color: accent },
  cancelEditBtn: {
    paddingVertical: 12,
    borderRadius: t.radius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelEditBtnText: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
  centeredMsg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
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
  postHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: t.textPrimary,
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: t.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: t.textShell,
    marginBottom: 10,
    minHeight: 64,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: t.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: t.textShell,
    marginBottom: 10,
  },
  postBtn: {
    paddingVertical: 14,
    borderRadius: t.radius,
    backgroundColor: accent,
    alignItems: 'center',
    marginBottom: 12,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  privacyNotice: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: t.borderFaint,
  },
  privacyTitle: { fontSize: 11, fontWeight: '700', color: accent, marginBottom: 4 },
  privacyBody: { fontSize: 11, color: t.textSecondary },
  bottomNav: {
    height: 72,
    backgroundColor: t.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: t.borderFaint,
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
  navIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxActive: { backgroundColor: `${accent}20` },
  navIcon: { fontSize: 20, color: t.textSecondary },
  navIconActive: { color: accent },
  navLabel: { fontSize: 10, color: t.textMuted },
  navLabelActive: { color: accent, fontWeight: '600' },
  });
}
