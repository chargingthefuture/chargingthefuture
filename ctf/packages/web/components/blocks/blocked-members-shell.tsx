'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldOff, UserX } from 'lucide-react';
import { BackChevronButton } from '@/lib/nav/back-history';
import { useTheme } from '@/hooks/useTheme';
import { getAccountDataTokens } from '@/components/account-data/account-data-shared';
import { deleteBlock, type BlockedMember, type BlocksListResponse } from './blocks-shared';

// Loading and error states are intentionally NOT theme-aware (mirrors the Account & Data shell): the
// default-dark palette is used so a loading screen never adopts the comic theme.
const { BG: DEFAULT_BG, TEXT: DEFAULT_TEXT } = getAccountDataTokens('default');

type LoadState = 'loading' | 'ready' | 'error';

// "Blocked members" manage-list (issue #809, task 2). Lists who the signed-in member has blocked,
// newest first, with the resolved display name and when each block was created, and an Unblock
// control on each row. Covers loading, error, empty, and populated states, and is mobile-responsive
// (the same surface reflows at phone width — the rows already stack). Lives under the account area
// at /account/blocks, reached from the account hub's "Data & privacy" section.
export function BlockedMembersShell() {
  const { theme } = useTheme();
  const tokens = getAccountDataTokens(theme);
  const { BG, SURFACE, BORDER, TEXT, SUBTLE, BRAND } = tokens;

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [blocks, setBlocks] = useState<BlockedMember[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadState('loading');
    try {
      const res = await fetch('/api/account/blocks', { signal });
      if (signal?.aborted) return;
      if (!res.ok) {
        setLoadState('error');
        return;
      }
      const data = (await res.json()) as BlocksListResponse;
      setBlocks(data.blocks ?? []);
      setLoadState('ready');
    } catch {
      if (!signal?.aborted) setLoadState('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleUnblock = useCallback(async (member: BlockedMember) => {
    setPendingId(member.blockedUserId);
    setRowError(null);
    try {
      await deleteBlock(member.blockedUserId);
      // Refetch-free optimistic removal: the server is idempotent, so dropping the row locally keeps
      // the list correct without a round-trip.
      setBlocks((prev) => prev.filter((b) => b.blockedUserId !== member.blockedUserId));
    } catch (error) {
      setRowError({ id: member.blockedUserId, message: error instanceof Error ? error.message : 'Unable to unblock. Please try again.' });
    } finally {
      setPendingId(null);
    }
  }, []);

  if (loadState === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100dvh', background: DEFAULT_BG, color: DEFAULT_TEXT, alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',system-ui" }}>
        <Loader2 size={22} className="blocks-spin" />
        <style>{'@keyframes blocks-spin{to{transform:rotate(360deg)}}.blocks-spin{animation:blocks-spin 0.8s linear infinite}'}</style>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ display: 'flex', height: '100dvh', background: DEFAULT_BG, color: DEFAULT_TEXT, alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',system-ui", padding: '0 32px' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>We couldn&apos;t load your blocked members</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.6 }}>Please refresh the page to try again.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{'@keyframes blocks-spin{to{transform:rotate(360deg)}}.blocks-spin{animation:blocks-spin 0.8s linear infinite}'}</style>

      <header style={{ height: 56, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, position: 'sticky', top: 0, background: BG, zIndex: 1 }}>
        <BackChevronButton accent={BRAND} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldOff size={17} color={BRAND} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>Blocked members</div>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 64px' }}>
        <p style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.6, margin: '0 0 24px' }}>
          People you&apos;ve blocked can&apos;t see or contact you, and they&apos;re never told. Unblock
          someone here to let them see and reach you again.
        </p>

        {blocks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: `${BRAND}08`, border: `1px dashed ${BRAND}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <UserX size={26} color={`${BRAND}80`} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>You haven&apos;t blocked anyone.</div>
            <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.6, maxWidth: 420 }}>
              When you block a member, they appear here so you can unblock them at any time.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blocks.map((member) => {
              const isPending = pendingId === member.blockedUserId;
              const error = rowError?.id === member.blockedUserId ? rowError.message : null;
              return (
                <div
                  key={member.blockedUserId}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${error ? 'rgba(239,68,68,0.35)' : BORDER}`, opacity: isPending ? 0.7 : 1, flexWrap: 'wrap' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${BRAND}10`, border: `1px solid ${BRAND}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BRAND, flexShrink: 0 }}>
                    <UserX size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.displayName}</div>
                    <div style={{ fontSize: 12, color: error ? '#F87171' : SUBTLE, lineHeight: 1.4 }}>
                      {error ?? `Blocked ${formatBlockedDate(member.createdAtIso)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(member)}
                    disabled={isPending}
                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: `${BRAND}12`, border: `1px solid ${BRAND}35`, color: BRAND, fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer' }}
                  >
                    {isPending ? <><Loader2 size={13} className="blocks-spin" /> Unblocking…</> : 'Unblock'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// A calm, human date for a block ("on Jun 24, 2026"). Falls back to nothing recognizable rather than
// throwing on an unexpected value.
function formatBlockedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  return `on ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
}
