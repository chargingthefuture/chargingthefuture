'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { reportError } from 'lib/observability/report';
import { useTheme } from '@/hooks/useTheme';
import { getChymeTokens } from './chyme-shared';

// A member's own mute of a speaker (3.1.0 plan, Personal controls). Their audio stops playing for
// this member alone and nobody is told. It is the same person mute Today uses (member_mutes, kind
// 'person', target = account id), so a person muted on a card is silent in every room too, and Me
// lists and lifts both.

type MuteRow = { id: string; kind: 'person' | 'words'; target: string; label: string | null };

export type RoomMutes = {
  mutedAccountIds: ReadonlySet<string>;
  mute: (accountId: string, label: string) => Promise<void>;
  unmute: (accountId: string) => Promise<void>;
  error: string | null;
};

const NO_MUTES: RoomMutes = {
  mutedAccountIds: new Set(),
  mute: async () => undefined,
  unmute: async () => undefined,
  error: null,
};

const RoomMutesContext = createContext<RoomMutes>(NO_MUTES);

const CSRF = { 'content-type': 'application/json', 'x-ctf-csrf': '1' } as const;

async function failure(res: Response, what: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return new Error(`${what}: ${body?.message ?? 'the server returned an error'} (HTTP ${res.status})`);
}

export function useRoomMutesState(): RoomMutes {
  const [rows, setRows] = useState<MuteRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      try {
        const res = await fetch('/api/account/mutes', { cache: 'no-store' });
        if (!res.ok) throw await failure(res, 'Your mutes could not be read');
        const body = (await res.json()) as { mutes?: MuteRow[] };
        if (!canceled) setRows((body.mutes ?? []).filter((m) => m.kind === 'person'));
      } catch (e) {
        // A failed read leaves everyone audible, which is the safe direction; it is reported.
        reportError(e, { area: 'chyme', op: 'room_mutes_read' });
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const mute = useCallback(async (accountId: string, label: string) => {
    setError(null);
    try {
      const res = await fetch('/api/account/mutes', { method: 'POST', headers: CSRF, body: JSON.stringify({ kind: 'person', target: accountId, label }) });
      if (!res.ok) throw await failure(res, 'Could not mute');
      const body = (await res.json()) as { mute: MuteRow };
      setRows((prev) => [body.mute, ...prev.filter((m) => m.target !== accountId)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mute.');
    }
  }, []);

  const unmute = useCallback(
    async (accountId: string) => {
      const row = rows.find((m) => m.target === accountId);
      if (!row) return;
      setError(null);
      try {
        const res = await fetch(`/api/account/mutes/${row.id}`, { method: 'DELETE', headers: CSRF });
        if (!res.ok) throw await failure(res, 'Could not unmute');
        setRows((prev) => prev.filter((m) => m.id !== row.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not unmute.');
      }
    },
    [rows],
  );

  const mutedAccountIds = useMemo(() => new Set(rows.map((m) => m.target)), [rows]);
  return { mutedAccountIds, mute, unmute, error };
}

export function RoomMutesProvider({ value, children }: { value: RoomMutes; children: ReactNode }) {
  return <RoomMutesContext.Provider value={value}>{children}</RoomMutesContext.Provider>;
}

export function useRoomMutes(): RoomMutes {
  return useContext(RoomMutesContext);
}

// The account id behind a Stream user id (`chyme-<accountId>`); guests have none.
export function accountIdOfStreamUser(streamUserId: string): string | null {
  if (streamUserId.startsWith('chyme-guest-') || !streamUserId.startsWith('chyme-')) return null;
  return streamUserId.slice('chyme-'.length);
}

export function ChymeMuteForMeButton({ accountId, name }: { accountId: string; name: string }) {
  const { theme } = useTheme();
  const color = getChymeTokens(theme).MUTED;
  const { mutedAccountIds, mute, unmute } = useRoomMutes();
  const [busy, setBusy] = useState(false);
  const muted = mutedAccountIds.has(accountId);
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={muted}
      onClick={() => {
        setBusy(true);
        void (muted ? unmute(accountId) : mute(accountId, name)).finally(() => setBusy(false));
      }}
      style={{ minHeight: 28, padding: '2px 8px', borderRadius: 20, border: `1px solid ${color}40`, background: 'transparent', color, fontSize: 10, cursor: busy ? 'default' : 'pointer' }}
    >
      {muted ? 'Unmute for me' : 'Mute for me'}
    </button>
  );
}
