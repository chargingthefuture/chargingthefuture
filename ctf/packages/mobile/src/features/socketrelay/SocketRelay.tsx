import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  createRequest,
  listRequests,
  fulfillRequest,
  socketRelayHandle,
  type SocketRelayRequest,
} from './api';
import { deriveTagChips, requestTags, suggestTags } from './tags';
import { SocketRelayTagInput } from './SocketRelayTagInput';
import { SocketRelayLoading } from './SocketRelayLoading';
import { SocketRelayEmpty } from './SocketRelayEmpty';

// Design color — from MobileSocketRelay.tsx mockup
const COLOR = '#FB923C';
// Note: need/offer distinction, urgency, and credits are not in the
// SocketRelayRequest model (title/details/tags/city/status only).
// Those mockup UI elements are omitted per real-data-only policy.

type NavKey = 'feed' | 'post';

export function SocketRelay() {
  const [activeNav, setActiveNav] = useState<NavKey>('feed');
  const [requests, setRequests] = useState<SocketRelayRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [helped, setHelped] = useState<string[]>([]);
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('All');

  // Post form state
  const [postTitle, setPostTitle] = useState('');
  const [postDetails, setPostDetails] = useState('');
  const [postTags, setPostTags] = useState<string[]>([]);
  const [postCity, setPostCity] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const loadFeed = useCallback(() => {
    setLoading(true);
    setError(null);
    listRequests()
      .then((res) => {
        setRequests(res.items);
      })
      .catch(() => setError('Failed to load requests.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeNav === 'feed') {
      loadFeed();
    }
  }, [activeNav, loadFeed]);

  const handleFulfill = async (requestId: string) => {
    if (helped.includes(requestId) || fulfilling === requestId) return;
    setFulfilling(requestId);
    try {
      await fulfillRequest(requestId);
      setHelped((prev) => [...prev, requestId]);
    } catch {
      // silently ignore — optimistic UI is not rolled back to avoid flash
    } finally {
      setFulfilling(null);
    }
  };

  const handlePost = async () => {
    if (!postTitle.trim() || postTags.length === 0) return;
    setPosting(true);
    setPostError(null);
    try {
      await createRequest({
        title: postTitle.trim().slice(0, 80),
        details: postDetails.trim(),
        tags: postTags,
        city: postCity.trim() || null,
        isPublic: true,
      });
      setPostTitle('');
      setPostDetails('');
      setPostTags([]);
      setPostCity('');
      setActiveNav('feed');
    } catch {
      setPostError('Failed to post request. Please try again.');
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
          <TouchableOpacity style={styles.retryBtn} onPress={loadFeed}>
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
      <ScrollView style={styles.feedScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.feedPad}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search requests…"
            placeholderTextColor="#4B5563"
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
                  {r.status !== 'open' && (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{r.status}</Text>
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

                <TouchableOpacity
                  style={[
                    styles.helpBtn,
                    helped.includes(r.id) && styles.helpBtnDone,
                  ]}
                  onPress={() => handleFulfill(r.id)}
                  disabled={
                    helped.includes(r.id) ||
                    fulfilling === r.id ||
                    r.status !== 'open'
                  }
                >
                  {fulfilling === r.id ? (
                    <ActivityIndicator size="small" color={COLOR} />
                  ) : (
                    <Text
                      style={[
                        styles.helpBtnText,
                        helped.includes(r.id) && styles.helpBtnTextDone,
                      ]}
                    >
                      {helped.includes(r.id)
                        ? '✓ Fulfilled'
                        : r.status === 'open'
                          ? 'I Can Help'
                          : 'Closed'}
                    </Text>
                  )}
                </TouchableOpacity>
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
      <Text style={styles.postHeading}>Post a Request or Offer</Text>

      <TextInput
        style={styles.textArea}
        placeholder="Title — what do you need or offer? (80 chars)"
        placeholderTextColor="#4B5563"
        value={postTitle}
        onChangeText={setPostTitle}
        maxLength={80}
      />
      <TextInput
        style={styles.textArea}
        placeholder="Details (optional)"
        placeholderTextColor="#4B5563"
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
        placeholderTextColor="#4B5563"
        value={postCity}
        onChangeText={setPostCity}
      />

      {postError ? (
        <Text style={styles.errorText}>{postError}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.postBtn, (!postTitle.trim() || postTags.length === 0) && styles.postBtnDisabled]}
        onPress={handlePost}
        disabled={posting || !postTitle.trim() || postTags.length === 0}
      >
        {posting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.postBtnText}>Post My Request</Text>
        )}
      </TouchableOpacity>

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
        >
          <Text style={styles.headerAddBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {activeNav === 'feed' ? renderFeed() : renderPost()}
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {(['feed', 'post'] as NavKey[]).map((key) => {
          const label = key === 'feed' ? 'Feed' : 'Post';
          const icon = key === 'feed' ? '↗' : '+';
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
    paddingTop: Platform.OS === 'android' ? 32 : 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#090B0F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerIconGlyph: { fontSize: 18, color: COLOR },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB' },
  headerSubtitle: { fontSize: 11, color: COLOR },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLOR,
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
    color: '#E8EAF0',
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
    backgroundColor: `${COLOR}15`,
    borderColor: `${COLOR}50`,
  },
  tagChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  tagChipTextActive: { color: COLOR },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: `${COLOR}30`,
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
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryBadgeText: { fontSize: 10, color: '#6B7280' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusBadgeText: { fontSize: 10, color: '#9CA3AF' },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 4,
    lineHeight: 20,
  },
  cardDetails: { fontSize: 12, color: '#9CA3AF', marginBottom: 6, lineHeight: 18 },
  cardPoster: { fontSize: 12, color: COLOR, fontWeight: '600', marginBottom: 4 },
  cardMeta: { fontSize: 11, color: '#6B7280', marginBottom: 10 },
  helpBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    alignItems: 'center',
  },
  helpBtnDone: {
    backgroundColor: '#22C55E20',
    borderColor: '#22C55E40',
  },
  helpBtnText: { fontSize: 12, fontWeight: '700', color: COLOR },
  helpBtnTextDone: { color: '#22C55E' },
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
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}40`,
  },
  retryBtnText: { color: COLOR, fontWeight: '700', fontSize: 13 },
  postHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#E8EAF0',
    marginBottom: 10,
    minHeight: 64,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#E8EAF0',
    marginBottom: 10,
  },
  postBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLOR,
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
    borderColor: 'rgba(255,255,255,0.06)',
  },
  privacyTitle: { fontSize: 11, fontWeight: '700', color: COLOR, marginBottom: 4 },
  privacyBody: { fontSize: 11, color: '#6B7280' },
  bottomNav: {
    height: 72,
    backgroundColor: '#090B0F',
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
  navIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxActive: { backgroundColor: `${COLOR}20` },
  navIcon: { fontSize: 20, color: '#6B7280' },
  navIconActive: { color: COLOR },
  navLabel: { fontSize: 10, color: '#4B5563' },
  navLabelActive: { color: COLOR, fontWeight: '600' },
});
