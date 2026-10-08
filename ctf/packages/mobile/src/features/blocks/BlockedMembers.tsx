// Blocked members — the Android copy of the web /account/blocks screen
// (components/blocks/blocked-members-shell.tsx). Reached from Your account; back returns there.
//
// Lists who the signed-in member has blocked, newest first, with an Unblock control on each row.
// Reads the live backend through the blocks API client. The loading and error screens use the
// default dark colors in either theme and carry no header, as on the web; pulling down on the error
// screen reloads, where the web asks the member to refresh the page.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ShieldOff, UserX } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { AccountBackButton, DEFAULT_ACCOUNT_TOKENS, getAccountTokens, radius, Spinner, type AccountTokens } from '../account';
import { fetchBlockedMembers, unblockMember, type BlockedMember } from './api';

type LoadState = 'loading' | 'ready' | 'error';

export function BlockedMembers({ onBack }: { onBack: () => void }) {
  const { tokens } = useTheme();
  const tok = getAccountTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [blocks, setBlocks] = useState<BlockedMember[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // `background` keeps the current screen up while a pull-to-refresh reloads the list.
  const load = useCallback(async (background = false) => {
    if (!background) setLoadState('loading');
    try {
      setBlocks(await fetchBlockedMembers());
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      // The server is idempotent, so dropping the row locally keeps the list correct.
      setBlocks((prev) => prev.filter((b) => b.blockedUserId !== member.blockedUserId));
    } catch (error) {
      setRowError({ id: member.blockedUserId, message: error instanceof Error ? error.message : 'Unable to unblock. Please try again.' });
    } finally {
      setPendingId(null);
    }
  }, []);

  if (loadState === 'loading') {
    return (
      <View style={[s.plain, s.center]}>
        <Spinner size={22} color={DEFAULT_ACCOUNT_TOKENS.TEXT} />
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <ScrollView
        style={s.plain}
        contentContainerStyle={s.center}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={s.errorTitle}>We couldn&apos;t load your blocked members</Text>
        <Text style={s.errorBody}>Please refresh the page to try again.</Text>
      </ScrollView>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <AccountBackButton accent={tok.BRAND} onPress={onBack} />
        <View style={s.headerTitleRow}>
          <ShieldOff size={17} color={tok.BRAND} />
          <Text style={s.headerTitle}>Blocked members</Text>
        </View>
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tok.BRAND} />}
      >
        <Text style={s.intro}>
          People you&apos;ve blocked can&apos;t see or contact you, and they&apos;re never told. Unblock someone here to let them see and reach you again.
        </Text>

        {blocks.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyTile}>
              <UserX size={26} color={`${tok.BRAND}80`} />
            </View>
            <Text style={s.emptyTitle}>You haven&apos;t blocked anyone.</Text>
            <Text style={s.emptyBody}>When you block a member, they appear here so you can unblock them at any time.</Text>
          </View>
        ) : (
          <View style={s.list}>
            {blocks.map((member) => {
              const isPending = pendingId === member.blockedUserId;
              const error = rowError?.id === member.blockedUserId ? rowError.message : null;
              return (
                <View key={member.blockedUserId} style={[s.row, error ? s.rowError : null, isPending ? s.rowPending : null]}>
                  <View style={s.rowTile}>
                    <UserX size={17} color={tok.BRAND} />
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
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${member.displayName}`}
                    style={s.unblock}
                  >
                    {isPending ? <Spinner size={13} color={tok.BRAND} /> : null}
                    <Text style={s.unblockText}>{isPending ? 'Unblocking…' : 'Unblock'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// A calm, human date for a block ("on Jun 24, 2026"). Mirrors the web's formatBlockedDate.
function formatBlockedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  return `on ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

function makeStyles(t: ThemeTokens, tok: AccountTokens) {
  return StyleSheet.create({
    plain: { flex: 1, backgroundColor: DEFAULT_ACCOUNT_TOKENS.BG },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    errorTitle: { fontSize: 18, fontFamily: interFamily('700'), color: DEFAULT_ACCOUNT_TOKENS.TEXT, marginBottom: 10, textAlign: 'center' },
    errorBody: { fontSize: 14, lineHeight: 22.4, fontFamily: interFamily('400'), color: '#9CA3AF', textAlign: 'center' },
    root: { flex: 1, backgroundColor: tok.BG },
    flex: { flex: 1 },
    header: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: tok.BORDER, backgroundColor: tok.BG },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 15, fontFamily: interFamily('700'), color: tok.TEXT },
    content: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 64 },
    intro: { fontSize: 14, lineHeight: 22.4, fontFamily: interFamily('400'), color: tok.SUBTLE, marginBottom: 24 },
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
    emptyTile: { width: 60, height: 60, borderRadius: radius(t, 18), backgroundColor: `${tok.BRAND}08`, borderWidth: 1, borderStyle: 'dashed', borderColor: `${tok.BRAND}30`, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
    emptyTitle: { fontSize: 18, fontFamily: interFamily('800'), color: tok.TEXT, marginBottom: 8, textAlign: 'center' },
    emptyBody: { fontSize: 14, lineHeight: 22.4, fontFamily: interFamily('400'), color: tok.SUBTLE, textAlign: 'center', maxWidth: 420 },
    list: { gap: 8 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius(t, 12), backgroundColor: tok.SURFACE, borderWidth: 1, borderColor: tok.BORDER },
    rowError: { borderColor: 'rgba(239,68,68,0.35)' },
    rowPending: { opacity: 0.7 },
    rowTile: { width: 38, height: 38, borderRadius: radius(t, 10), backgroundColor: `${tok.BRAND}10`, borderWidth: 1, borderColor: `${tok.BRAND}20`, alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1, minWidth: 0 },
    rowName: { fontSize: 14, fontFamily: interFamily('600'), color: tok.TEXT, marginBottom: 2 },
    rowMeta: { fontSize: 12, lineHeight: 16.8, fontFamily: interFamily('400'), color: tok.SUBTLE },
    rowMetaError: { color: '#F87171' },
    unblock: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius(t, 9), backgroundColor: `${tok.BRAND}12`, borderWidth: 1, borderColor: `${tok.BRAND}35` },
    unblockText: { fontSize: 13, fontFamily: interFamily('600'), color: tok.BRAND },
  });
}
