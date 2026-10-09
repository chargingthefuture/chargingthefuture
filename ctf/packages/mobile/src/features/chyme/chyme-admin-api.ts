// The Chyme admin reads and writes the web admin screens use (web components/chyme/
// chyme-stream-usage-shell.tsx and readings/chyme-readings-admin.tsx). Admin-only on the server.

import { authedFetch, authedFetchJson } from '../../auth/authedFetch';

type Band = 'green' | 'yellow' | 'orange' | 'red';

export type UsageDay = { dateIso: string; minutes: number };

export type UsagePayload = {
  ok: true;
  usage: {
    monthStartIso: string;
    todayIso: string;
    daysElapsed: number;
    daysInMonth: number;
    budgetMinutes: number;
    usedMinutes: number;
    percentUsed: number;
    band: Band;
    todayMinutes: number;
    projectedMonthMinutes: number;
    projectedPercent: number;
    bySurface: { surface: string; minutes: number }[];
    byDay: UsageDay[];
    earliestDateIso: string;
  };
  policy: {
    band: Band;
    memberCap: number;
    guestCap: number;
    guestListenAllowed: boolean;
    backChannelAllowed: boolean;
    memberNotice: string | null;
  };
  room: { roomName: string; isLive: boolean; participantCount: number; guestCount: number };
  config: { budgetMinutes: number; maxParticipants: number; maxGuestListeners: number; redBandMaxParticipants: number };
};

export type RoomRemoval = {
  id: string;
  roomKey: string;
  roomName: string;
  userId: string;
  username: string | null;
  reason: string | null;
  removedAtIso: string;
};

// The route's own message and the status, as the web screen prints it.
export async function getStreamUsage(): Promise<UsagePayload> {
  const response = await authedFetch('/api/chyme/admin/stream-usage');
  const body = (await response.json().catch(() => null)) as UsagePayload | { message?: string } | null;
  if (!response.ok || !body || !('ok' in body) || body.ok !== true) {
    const message = body && 'message' in body && typeof body.message === 'string' ? body.message : 'The server returned an error.';
    throw new Error(`${message} (HTTP ${response.status})`);
  }
  return body;
}

export async function getRemovals(): Promise<RoomRemoval[]> {
  const payload = await authedFetchJson<{ ok: true; removals: RoomRemoval[] }>('/api/chyme/admin/removals');
  return payload.removals;
}

export async function postLiftRemoval(row: RoomRemoval): Promise<{ ok: true; streamNotice?: string }> {
  const scope = row.roomKey === 'chyme-contributors-room' ? '?room=contributors' : '';
  return authedFetchJson(`/api/chyme/admin/lift-removal${scope}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ userId: row.userId }),
  });
}

export async function getReadingsSetting(): Promise<{ enabled: boolean }> {
  const payload = await authedFetchJson<{ ok: true; setting: { enabled: boolean } }>('/api/chyme/readings/admin');
  return payload.setting;
}

export async function postReadingsSetting(enabled: boolean): Promise<void> {
  await authedFetchJson('/api/chyme/readings/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ enabled }),
  });
}
