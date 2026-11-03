'use client';

import { useCallback, useEffect, useState } from 'react';

// Whether the Main Room is live and a visitor may listen, from /api/chyme/public/room (the same read
// the signed-out room page uses). Listening itself starts on the tap, inside ChymeGuestListen.

export type GuestRoom =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; isLive: boolean; participantCount: number; guestCount: number; listenAllowed: boolean; listenUnavailable: string | null };

export function useGuestRoom() {
  const [room, setRoom] = useState<GuestRoom>({ kind: 'loading' });
  const load = useCallback(async () => {
    const res = await fetch('/api/chyme/public/room').catch((error: unknown) => error as Error);
    if (res instanceof Error) return setRoom({ kind: 'failed', message: `The room could not be checked: ${res.message}` });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || body?.ok !== true) {
      const message = typeof body?.message === 'string' ? body.message : 'The server returned an error.';
      return setRoom({ kind: 'failed', message: `${message} (HTTP ${res.status})` });
    }
    setRoom({
      kind: 'ready',
      isLive: body.isLive === true,
      participantCount: typeof body.participantCount === 'number' ? body.participantCount : 0,
      guestCount: typeof body.guestCount === 'number' ? body.guestCount : 0,
      listenAllowed: body.guestListenAllowed === true,
      listenUnavailable: typeof body.listenUnavailable === 'string' ? body.listenUnavailable : null,
    });
  }, []);
  useEffect(() => void load(), [load]);
  return { room, reload: load };
}
