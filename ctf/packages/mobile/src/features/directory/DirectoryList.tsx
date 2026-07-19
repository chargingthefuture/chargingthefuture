// Directory browse screen — aligned to MobileDirectory.tsx mockup.
// Real data only: binds to GET /api/directory/list + GET /api/directory/sectors.
// Fields with no backend counterpart are omitted (never faked):
//   - per-profile online/offline status (no real-time presence API)
//   - verified checkmark (no verified field on DirectoryListItem)
//   - location (no location field)
//   - "Book Session" / "Message" CTAs (no booking/messaging API in this plugin)
//   - endorsements (no endorsements API)

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  DirectoryListItem,
  DirectorySector,
  MemberPresenceEntry,
  MemberTrustState,
} from './api';
import {
  fetchDirectoryList,
  fetchDirectorySectors,
  fetchMemberPresence,
  fetchMemberTrust,
} from './api';
import { TrustEvidencePanel } from '../trust/TrustEvidencePanel';
import { WeaversBadgeControl } from '../contributor-access';
import { ShareLink } from '../../components/shared/ShareLink';
import { getApiBaseUrl } from '../../auth/authedFetch';
import { getAppAccent, useTheme, type ThemeTokens } from '../../theme';

const COMMUNITY_COLOR = '#FBBF24';

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

function fullName(p: { firstName: string; lastName: string | null }): string {
  return [p.firstName, p.lastName].filter((s) => s && s.trim().length > 0).join(' ').trim();
}

// ── Loading state ─────────────────────────────────────────────────────────────

function DirectoryLoading() {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('directory', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingTagline}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.loadingTagline}>EXIT THE PSYOP</Text>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function DirectoryEmpty({ onRetry }: { onRetry: () => void }) {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('directory', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>📇</Text>
      </View>
      <Text style={styles.emptyTitle}>No profiles yet</Text>
      <Text style={styles.emptyBody}>
        Add your skills and availability. Other members can find and connect with you securely.
      </Text>
      <TouchableOpacity style={styles.emptyRetry} onPress={onRetry}>
        <Text style={styles.emptyRetryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Profile detail view ───────────────────────────────────────────────────────

function ProfileDetail({
  profile,
  onBack,
  onNavigateToFoundation,
}: {
  profile: DirectoryListItem;
  onBack: () => void;
  onNavigateToFoundation?: () => void;
}) {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('directory', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const acceptsCredits = !!(
    profile.serviceCreditsAddress ||
    profile.venmoAddress ||
    profile.moneroAddress ||
    profile.bitcoinAddress
  );
  const avatarText = initials(fullName(profile));
  // "City, State, Country" from whichever parts are set (non-US members may have only a country).
  const locationText = [profile.city, profile.state, profile.country]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0)
    .join(', ');
  const isCommunity = profile.source === 'community-generated';
  // handle: unclaimed_handle for community profiles; omit otherwise
  const handle = isCommunity && profile.unclaimedHandle ? `@${profile.unclaimedHandle}` : null;
  // Skills nominated through SkillsHunt but not yet in the taxonomy — shown as muted "pending
  // review" chips so a community-generated profile's Skills section is never empty.
  const pendingSkills = profile.pendingSkills ?? [];

  // Absolute deep link to this profile, the destination a shared ShareLink points at. The web page
  // (/apps/directory/profile/[id]) is auth-gated: a signed-in member opens that profile, an
  // unauthenticated visitor is redirected to the directory landing. Built from the same APP_URL the
  // API calls resolve against; if it is unset we render no share control rather than crash.
  let shareUrl: string | null = null;
  try {
    shareUrl = `${getApiBaseUrl()}/apps/directory/profile/${encodeURIComponent(profile.id)}`;
  } catch {
    shareUrl = null;
  }

  // Cross-plugin presence + trust — only for a claimed profile. Presence shows where else this
  // member is active; the trust card sits below as peer social proof. Both are best-effort reads.
  const claimedUserId = profile.claimedByUserId;
  const [presence, setPresence] = useState<MemberPresenceEntry[]>([]);
  const [trustState, setTrustState] = useState<MemberTrustState>({ kind: 'hidden' });

  useEffect(() => {
    if (!claimedUserId) {
      setPresence([]);
      setTrustState({ kind: 'hidden' });
      return;
    }
    let cancelled = false;
    void (async () => {
      const [p, t] = await Promise.all([
        fetchMemberPresence(claimedUserId),
        fetchMemberTrust(claimedUserId),
      ]);
      if (!cancelled) {
        setPresence(p);
        setTrustState(t);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimedUserId]);

  return (
    <View style={styles.root}>
      {/* Status bar area */}
      <View style={styles.statusBar}>
        <Text style={styles.statusBarTime}>9:41</Text>
        <Text style={styles.statusBarBattery}>100%</Text>
      </View>
      {/* Nav bar */}
      <View style={styles.detailNavBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>&#8592; Back</Text>
        </TouchableOpacity>
        <Text style={styles.detailNavTitle}>Profile</Text>
        {shareUrl ? (
          <View style={styles.detailNavShare}>
            <ShareLink url={shareUrl} title="Share this profile" color={accent} />
          </View>
        ) : (
          <View style={styles.detailNavSpacer} />
        )}
      </View>
      <ScrollView style={styles.detailScroll}>
        <View style={styles.detailContent}>
          {/* Avatar */}
          <View style={styles.detailAvatarWrap}>
            <View style={styles.detailAvatar}>
              <Text style={styles.detailAvatarText}>{avatarText}</Text>
            </View>
          </View>
          {/* Name + badges */}
          <View style={styles.detailNameRow}>
            <Text style={styles.detailName}>{fullName(profile)}</Text>
            {/* Weavers of the Commons badge — claimed badge-holders only; positive-only, so
                nothing badge-related renders for anyone else (mirrors the web profile detail). */}
            {claimedUserId != null && profile.hasWeaversBadge === true && (
              <WeaversBadgeControl size={20} />
            )}
            {isCommunity && (
              <View style={styles.communityBadge}>
                <Text style={styles.communityBadgeText}>Community generated</Text>
              </View>
            )}
          </View>
          {handle ? (
            <Text style={styles.detailHandle}>{handle}</Text>
          ) : null}
          {/* Role / job title */}
          {profile.jobTitleName ? (
            <Text style={styles.detailRole}>{profile.jobTitleName}</Text>
          ) : null}
          {/* Sector badge */}
          {profile.sectorName ? (
            <View style={styles.sectorBadgeRow}>
              <View style={styles.sectorBadge}>
                <Text style={styles.sectorBadgeText}>{profile.sectorName}</Text>
              </View>
            </View>
          ) : null}
          {/* Location */}
          {locationText ? (
            <Text style={styles.detailLocation}>{locationText}</Text>
          ) : null}
          {/* Credits badge */}
          {acceptsCredits ? (
            <View style={styles.creditsBadgeRow}>
              <View style={styles.creditsBadge}>
                <Text style={styles.creditsBadgeText}>Credits ✓</Text>
              </View>
            </View>
          ) : null}
          {/* Skills */}
          {profile.skills.length > 0 || pendingSkills.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>Skills</Text>
              <View style={styles.skillsRow}>
                {profile.skills.map((s) => (
                  <React.Fragment key={s.id}>
                    <View style={styles.skillChip}>
                      <Text style={styles.skillChipText}>{s.name}</Text>
                    </View>
                  </React.Fragment>
                ))}
                {pendingSkills.map((s) => (
                  <React.Fragment key={`pending-${s}`}>
                    <View style={styles.pendingSkillChip}>
                      <Text style={styles.pendingSkillChipText}>
                        {s}
                        <Text style={styles.pendingSkillChipMuted}> · pending review</Text>
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          ) : null}
          {/* Bio */}
          {profile.bio ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>About</Text>
              <Text style={styles.detailBio}>{profile.bio}</Text>
            </View>
          ) : null}
          {/* How to connect — the directory is read-only, so reaching out happens through Foundation,
              where members offer and exchange help. */}
          <View style={styles.connectBox}>
            <Text style={styles.connectTitle}>✨ Want to work together?</Text>
            <Text style={styles.connectBody}>
              The directory shows who is in the community and what they do. Want a service or good
              from this person? Find members who offer and exchange help in{' '}
              <Text
                style={styles.connectLink}
                onPress={onNavigateToFoundation}
                accessibilityRole={onNavigateToFoundation ? 'link' : undefined}
              >
                Foundation
              </Text>
              .
            </Text>
          </View>
          {/* Also active in + Trust — only for a claimed profile. Presence shows where else this
              member is active across plugins; the trust card sits below as peer social proof.
              Unclaimed profiles show neither. */}
          {claimedUserId && (presence.length > 0 || trustState.kind !== 'hidden') ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>Also active in</Text>
              {presence.length > 0 ? (
                <View style={styles.presenceList}>
                  {presence.map((entry) => (
                    <React.Fragment key={`${entry.pluginSlug}:${entry.refType}:${entry.refId}`}>
                      <View style={styles.presenceRow}>
                        <Text style={styles.presenceIcon}>↗</Text>
                        <Text style={styles.presenceLabel} numberOfLines={1}>
                          {entry.label}
                        </Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <Text style={styles.presenceEmpty}>No activity in other plugins yet.</Text>
              )}
              {trustState.kind === 'ready' ? (
                <TrustEvidencePanel trust={trustState.trust} compact />
              ) : null}
              {trustState.kind === 'restricted' ? (
                <View style={styles.trustRestricted}>
                  <Text style={styles.trustRestrictedText}>
                    This member limits who can view their trust.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {/* Privacy note */}
          <View style={styles.privacyBox}>
            <Text style={styles.privacyTitle}>🔒 Privacy First</Text>
            <Text style={styles.privacyBody}>
              Profiles show only what each member chooses to share.
            </Text>
          </View>
          {/* Endorsements omitted — no endorsements API */}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Profile card (list item) ───────────────────────────────────────────────────

function ProfileCard({
  profile,
  onPress,
}: {
  profile: DirectoryListItem;
  onPress: () => void;
}) {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('directory', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const isCommunity = profile.source === 'community-generated';
  const acceptsCredits = !!(
    profile.serviceCreditsAddress ||
    profile.venmoAddress ||
    profile.moneroAddress ||
    profile.bitcoinAddress
  );
  const avatarText = initials(fullName(profile));
  const handle = isCommunity && profile.unclaimedHandle ? `@${profile.unclaimedHandle}` : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>{avatarText}</Text>
      </View>
      {/* Info */}
      <View style={styles.cardInfo}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>{fullName(profile)}</Text>
          {isCommunity && (
            <View style={styles.cardCommunityBadge}>
              <Text style={styles.cardCommunityBadgeText}>Community</Text>
            </View>
          )}
        </View>
        {handle ? (
          <Text style={styles.cardHandle} numberOfLines={1}>{handle}</Text>
        ) : null}
        {profile.jobTitleName ? (
          <Text style={styles.cardRole} numberOfLines={1}>{profile.jobTitleName}</Text>
        ) : null}
        {acceptsCredits ? (
          <Text style={styles.cardCredits}>Credits ✓</Text>
        ) : null}
      </View>
      <Text style={styles.cardChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export const DirectoryList = ({
  onNavigateToFoundation,
  onEditProfile,
}: {
  onNavigateToFoundation?: () => void;
  onEditProfile?: () => void;
} = {}) => {
  const { theme, tokens } = useTheme();
  const accent = getAppAccent('directory', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [profiles, setProfiles] = useState<DirectoryListItem[]>([]);
  const [sectors, setSectors] = useState<DirectorySector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DirectoryListItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    // Pull-to-refresh keeps the current list on screen instead of flashing the loading state.
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [listData, sectorData] = await Promise.all([
        fetchDirectoryList({
          q: query || undefined,
          sectorId: activeSectorId ?? undefined,
          pageSize: 50,
        }),
        fetchDirectorySectors(),
      ]);
      setProfiles(listData.items);
      setSectors(sectorData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [query, activeSectorId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pull-to-refresh: re-pull profiles and sectors without flashing the loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (selected) {
    return (
      <ProfileDetail
        profile={selected}
        onBack={() => setSelected(null)}
        onNavigateToFoundation={onNavigateToFoundation}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusBarTime}>9:41</Text>
        <Text style={styles.statusBarBattery}>100%</Text>
      </View>

      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Text style={styles.headerIconText}>📇</Text>
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Directory</Text>
          </View>
          {onEditProfile ? (
            <TouchableOpacity style={styles.editProfileBtn} onPress={onEditProfile} accessibilityRole="button">
              <Text style={styles.editProfileBtnText}>Edit my profile</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search providers, skills…"
            placeholderTextColor={tokens.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Sector filter chips (real data) */}
      {sectors.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContainer}
        >
          <TouchableOpacity
            style={[styles.filterChip, !activeSectorId && styles.filterChipActive]}
            onPress={() => setActiveSectorId(null)}
          >
            <Text style={[styles.filterChipText, !activeSectorId && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {sectors.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.filterChip, activeSectorId === s.id && styles.filterChipActive]}
              onPress={() => setActiveSectorId(activeSectorId === s.id ? null : s.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeSectorId === s.id && styles.filterChipTextActive,
                ]}
              >
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {/* Content */}
      {loading ? (
        <DirectoryLoading />
      ) : error ? (
        <DirectoryEmpty onRetry={() => void load()} />
      ) : profiles.length === 0 ? (
        <DirectoryEmpty onRetry={() => void load()} />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={accent} />}
          renderItem={({ item }) => (
            <ProfileCard profile={item} onPress={() => setSelected(item)} />
          )}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },

    // Status bar
    statusBar: {
      height: 44,
      backgroundColor: t.surfaceAlt,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    statusBarTime: { fontSize: 13, fontWeight: '700', color: t.textShell },
    statusBarBattery: { fontSize: 12, color: t.textSecondary },

    // Header
    headerWrap: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    headerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: `${accent}30`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    headerIconText: { fontSize: 18 },
    headerTitleWrap: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: t.textPrimary },
    editProfileBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 9,
      backgroundColor: `${accent}18`,
      borderWidth: 1,
      borderColor: `${accent}40`,
    },
    editProfileBtnText: { fontSize: 12, fontWeight: '700', color: accent },

    // Search
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 12,
      height: 40,
    },
    searchIcon: { fontSize: 13, marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: t.textShell },

    // Filters
    filtersScroll: {
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
      maxHeight: 46,
    },
    filtersContainer: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', gap: 6 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      marginRight: 6,
    },
    filterChipActive: {
      backgroundColor: `${accent}20`,
      borderColor: `${accent}50`,
    },
    filterChipText: { fontSize: 12, fontWeight: '600', color: t.textSecondary },
    filterChipTextActive: { color: accent },

    // List
    list: { flex: 1 },
    listContent: { padding: 16 },

    // Card
    card: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: `${accent}15`,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: `${accent}25`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    cardAvatarText: { fontSize: 18, fontWeight: '800', color: accent },
    cardInfo: { flex: 1, minWidth: 0 },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
    cardName: { fontSize: 14, fontWeight: '700', color: t.textPrimary, flexShrink: 1 },
    cardCommunityBadge: {
      backgroundColor: `${COMMUNITY_COLOR}20`,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: `${COMMUNITY_COLOR}30`,
      paddingHorizontal: 5,
      paddingVertical: 1,
      flexShrink: 0,
    },
    cardCommunityBadgeText: { fontSize: 9, fontWeight: '700', color: COMMUNITY_COLOR },
    cardHandle: { fontSize: 10, color: '#374151', fontFamily: 'monospace', marginBottom: 2 },
    cardRole: { fontSize: 12, color: t.textSecondary, marginBottom: 3 },
    cardCredits: { fontSize: 10, color: '#F59E0B' },
    cardChevron: { fontSize: 22, color: t.textMuted, marginLeft: 8, flexShrink: 0 },

    // Loading state
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    loadingTagline: {
      fontSize: 10,
      letterSpacing: 2.5,
      color: 'rgba(255,255,255,0.22)',
      textTransform: 'uppercase',
      fontWeight: '500',
      lineHeight: 20,
      textAlign: 'center',
    },

    // Empty state
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: `${accent}15`,
      borderWidth: 1,
      borderColor: `${accent}40`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyIconText: { fontSize: 30 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: t.textPrimary, marginBottom: 10 },
    emptyBody: {
      fontSize: 14,
      color: t.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 28,
    },
    emptyRetry: {
      backgroundColor: accent,
      borderRadius: t.radius,
      paddingVertical: 12,
      paddingHorizontal: 32,
    },
    emptyRetryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    // Detail nav bar
    detailNavBar: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: t.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.borderFaint,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    backBtnText: { fontSize: 13, fontWeight: '700', color: accent },
    detailNavTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
      color: t.textPrimary,
      textAlign: 'center',
    },
    detailNavSpacer: { width: 40 },
    detailNavShare: { minWidth: 40, alignItems: 'flex-end' },

    detailScroll: { flex: 1 },
    detailContent: { padding: 24 },
    detailAvatarWrap: { alignItems: 'center', marginBottom: 12 },
    detailAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: `${accent}30`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailAvatarText: { fontSize: 28, fontWeight: '800', color: accent },
    detailNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 4,
    },
    detailName: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
    communityBadge: {
      backgroundColor: `${COMMUNITY_COLOR}20`,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: `${COMMUNITY_COLOR}30`,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    communityBadgeText: { fontSize: 10, fontWeight: '700', color: COMMUNITY_COLOR },
    detailHandle: {
      fontSize: 11,
      color: '#374151',
      fontFamily: 'monospace',
      marginBottom: 4,
      textAlign: 'center',
    },
    detailRole: { fontSize: 14, color: t.textSecondary, marginBottom: 8, textAlign: 'center' },
    detailLocation: { fontSize: 13, color: t.textSecondary, marginBottom: 8, textAlign: 'center' },
    sectorBadgeRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 6 },
    sectorBadge: {
      backgroundColor: `${accent}10`,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: `${accent}25`,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    sectorBadgeText: { fontSize: 11, color: accent },
    creditsBadgeRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    creditsBadge: {
      backgroundColor: '#F59E0B10',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#F59E0B25',
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    creditsBadgeText: { fontSize: 11, color: '#F59E0B' },

    detailSection: { marginBottom: 20 },
    detailSectionLabel: { fontSize: 14, fontWeight: '700', color: t.textSecondary, marginBottom: 10 },
    skillsRow: { flexDirection: 'row', flexWrap: 'wrap' },
    skillChip: {
      backgroundColor: `${accent}10`,
      borderRadius: t.radiusChip,
      borderWidth: 1,
      borderColor: `${accent}25`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginRight: 6,
      marginBottom: 6,
    },
    skillChipText: { fontSize: 11, color: accent },
    pendingSkillChip: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius: t.radiusChip,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginRight: 6,
      marginBottom: 6,
    },
    pendingSkillChipText: { fontSize: 11, color: t.textSecondary, fontWeight: '500' },
    pendingSkillChipMuted: { fontSize: 11, color: t.textSecondary, fontWeight: '400' },
    connectBox: {
      backgroundColor: `${accent}0F`,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: `${accent}25`,
      padding: 14,
      marginBottom: 20,
    },
    connectTitle: { fontSize: 13, fontWeight: '700', color: accent, marginBottom: 6 },
    connectBody: { fontSize: 13, color: t.textSecondary, lineHeight: 20 },
    connectLink: { color: accent, fontWeight: '600' },
    presenceList: { marginBottom: 14 },
    presenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: `${accent}0A`,
      borderWidth: 1,
      borderColor: `${accent}25`,
      marginBottom: 8,
    },
    presenceIcon: { fontSize: 14, color: accent },
    presenceLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: t.textSecondary },
    presenceEmpty: { fontSize: 13, color: t.textSecondary, marginBottom: 14 },
    trustRestricted: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    trustRestrictedText: { fontSize: 13, color: t.textSecondary, lineHeight: 19 },
    detailBio: { fontSize: 13, color: t.textSecondary, lineHeight: 20 },

    privacyBox: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: `${accent}08`,
      borderWidth: 1,
      borderColor: `${accent}18`,
      marginBottom: 16,
    },
    privacyTitle: { fontSize: 12, fontWeight: '700', color: accent, marginBottom: 6 },
    privacyBody: { fontSize: 12, color: t.textSecondary, lineHeight: 19 },
  });
}
