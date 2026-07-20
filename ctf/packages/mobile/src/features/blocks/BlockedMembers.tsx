// "Blocked members" manage screen (mobile) — Android parity for issue #809, mirrors the web's
// components/blocks/blocked-members-shell.tsx.
//
// Lists who the signed-in member has blocked, newest first, with the resolved display name and when
// each block was created, and an Unblock control on each row. Covers loading, error, empty, and
// populated states. Reads the live backend through the blocks API client (no mobile-only endpoint).
// Visual style follows the shipped Account & Data screen so it matches the rest of the settings area.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { fetchBlockedMembers, unblockMember, type BlockedMember } from './api';

type LoadState = 'loading' | 'ready' | 'error';

// The blocked-members accent matches the Account & Data destructive zone: comic-danger in comic
// theme, the pink brand in default theme — the same pairing the web uses for the account area.
function accentFor(t: ThemeTokens): string {
  return t.isComic ? '#B91C1C' : '#D946EF';
}

export function BlockedMembers() {
  const { tokens } = useTheme();
  const brand = accentFor(tokens);
  const s = useMemo(() => makeStyles(tokens, brand), [tokens, brand]);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [blocks, setBlocks] = useState<BlockedMember[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // `background` skips the full-screen spinner so pull-to-refresh keeps the current list visible.
  const load = useCallback((background = false) => {
    if (!background) setLoadState('loading');
    return fetchBlockedMembers()
      .then((rows) => {
        setBlocks(rows);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh: re-pull the block list without flashing the loading state.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleUnblock = useCallback(async (member: BlockedMember) => {
    setPendingId(member.blockedUserId);
    setRowError(null);
    try {
      await unblockMember(member.blockedUserId);
      // Optimistic removal: the server is idempotent, so dropping the row locally keeps the list
      // correct without a refetch.
      setBlocks((prev) => prev.filter((b) => b.blockedUserId !== member.blockedUserId));
    } catch (error) {
      setRowError({
        id: member.blockedUserId,
        message: error instanceof Error ? error.message : 'Unable to unblock. Please try again.',
      });
    } finally {
      setPendingId(null);
    }
  }, []);

  if (loadState === 'loading') {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={brand} />
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.errTitle}>We couldn&apos;t load your blocked members</Text>
        <Text style={s.errSub}>Please try again.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => load()} accessibilityRole="button">
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerIcon}>
            <Text style={s.headerIconText}>🛡</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>Blocked members</Text>
            <Text style={s.headerSub}>{blocks.length} {blocks.length === 1 ? 'person' : 'people'} · your control</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand} />}
      >
        <Text style={s.intro}>
          People you&apos;ve blocked can&apos;t see or contact you, and they&apos;re never told.
          Unblock someone here to let them see and reach you again.
        </Text>

        {blocks.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyAnchor}>
              <Text style={s.emptyAnchorText}>🚫</Text>
            </View>
            <Text style={s.emptyTitle}>You haven&apos;t blocked anyone.</Text>
            <Text style={s.emptySub}>
              When you block a member, they appear here so you can unblock them at any time.
            </Text>
          </View>
        ) : (
          <View style={s.list}>
            {blocks.map((member) => {
              const isPending = pendingId === member.blockedUserId;
              const error = rowError?.id === member.blockedUserId ? rowError.message : null;
              return (
                <React.Fragment key={member.blockedUserId}>
                  <View style={[s.row, error ? s.rowError : null, isPending && s.rowPending]}>
                    <View style={s.rowGlyph}>
                      <Text style={s.rowGlyphText}>🚫</Text>
                    </View>
                    <View style={s.rowBody}>
                      <Text style={s.rowName} numberOfLines={1}>{member.displayName}</Text>
                      <Text style={[s.rowMeta, error ? s.rowMetaError : null]}>
                        {error ?? `Blocked ${formatBlockedDate(member.createdAtIso)}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleUnblock(member)}
                      disabled={isPending}
                      style={s.unblockBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Unblock ${member.displayName}`}
                    >
                      {isPending ? (
                        <ActivityIndicator color={brand} size="small" />
                      ) : (
                        <Text style={s.unblockText}>Unblock</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// A calm, human date for a block ("on Jun 24, 2026"). Falls back to a neutral word rather than
// throwing on an unexpected value. Mirrors the web's formatBlockedDate.
function formatBlockedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  return `on ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

function makeStyles(t: ThemeTokens, brand: string) {
  const danger = t.danger;
  const r = t.radius;
  const rChip = t.radiusChip;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: t.isComic ? 2 : 1, borderBottomColor: t.border },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerIcon: { width: 34, height: 34, borderRadius: rChip, backgroundColor: t.isComic ? t.bg : `${brand}20`, borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? t.border : `${brand}35`, alignItems: 'center', justifyContent: 'center' },
    headerIconText: { fontSize: 16, color: brand, fontFamily: interFamily('400') },
    headerTitle: { fontSize: 16, fontWeight: '700', fontFamily: interFamily('700'), color: t.textPrimary, letterSpacing: t.isComic ? 0.6 : 0, textTransform: t.isComic ? 'uppercase' : 'none' },
    headerSub: { fontSize: 11, color: t.textSecondary, fontFamily: interFamily('400') },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 28 },
    intro: { fontSize: 13, color: t.textSecondary, lineHeight: 20, marginBottom: 18, fontFamily: interFamily('400') },
    list: { gap: t.isComic ? 5 : 7 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: r, backgroundColor: t.surface, borderWidth: t.isComic ? 1.5 : 1, borderColor: t.isComic ? `${t.border}35` : t.border },
    rowError: { borderColor: t.isComic ? danger : 'rgba(239,68,68,0.35)' },
    rowPending: { opacity: 0.7 },
    rowGlyph: { width: 30, height: 30, borderRadius: rChip, backgroundColor: t.isComic ? `${t.border}0C` : `${brand}10`, borderWidth: 1, borderColor: t.isComic ? `${t.border}30` : `${brand}20`, alignItems: 'center', justifyContent: 'center' },
    rowGlyphText: { fontSize: 14, fontFamily: interFamily('400') },
    rowBody: { flex: 1 },
    rowName: { fontSize: 13, fontWeight: t.isComic ? '700' : '600', fontFamily: interFamily(t.isComic ? '700' : '600'), color: t.textPrimary },
    rowMeta: { fontSize: t.isComic ? 10 : 11, color: t.textMuted, lineHeight: 15, marginTop: 1, fontFamily: interFamily('400') },
    rowMetaError: { color: t.isComic ? danger : '#F87171' },
    unblockBtn: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: t.isComic ? 0 : 9, backgroundColor: t.isComic ? t.surface : `${brand}12`, borderWidth: 1.5, borderColor: t.isComic ? brand : `${brand}35`, minWidth: 76, alignItems: 'center' },
    unblockText: { color: brand, fontSize: 13, fontWeight: '600', fontFamily: interFamily('600') },
    emptyWrap: { alignItems: 'center', paddingVertical: 32 },
    emptyAnchor: { width: 56, height: 56, borderRadius: t.isComic ? 0 : 16, backgroundColor: t.isComic ? `${t.border}14` : `${brand}14`, borderWidth: t.isComic ? 2 : 1, borderColor: t.isComic ? t.border : `${brand}30`, borderStyle: t.isComic ? 'solid' : 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyAnchorText: { fontSize: 24, fontFamily: interFamily('400') },
    emptyTitle: { fontSize: 19, fontWeight: '800', fontFamily: interFamily('800'), color: t.textPrimary, marginBottom: 8, textAlign: 'center' },
    emptySub: { fontSize: 13, color: t.textSecondary, lineHeight: 20, textAlign: 'center', fontFamily: interFamily('400') },
    errTitle: { fontSize: 16, fontWeight: '700', fontFamily: interFamily('700'), color: t.textPrimary, marginBottom: 8, textAlign: 'center' },
    errSub: { fontSize: 13, color: t.textSecondary, textAlign: 'center', marginBottom: 16, fontFamily: interFamily('400') },
    retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: r, backgroundColor: t.isComic ? `${t.border}15` : `${brand}15`, borderWidth: 1, borderColor: t.isComic ? t.border : `${brand}30` },
    retryText: { color: t.isComic ? t.textPrimary : brand, fontSize: 14, fontWeight: '600', fontFamily: interFamily('600') },
  });
}
