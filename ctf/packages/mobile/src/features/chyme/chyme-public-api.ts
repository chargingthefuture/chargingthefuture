// The signed-out Chyme reads and writes, copied from the web public page (web components/chyme/
// chyme-public-shell.tsx, chyme-guest-listen.tsx, chyme-guest-chat.tsx). The routes under
// /api/chyme/public/* need no account; the listener is identified by the cookie the listen route
// sets, which the app's network layer keeps and sends back like a browser does.

import { authedFetch } from '../../auth/authedFetch';
import type { ChymeMessage } from './ChymeApi';

export type LiveState = {
  isLive: boolean;
  participantCount: number;
  guestCount: number;
  roomName?: string;
  guestListenAllowed?: boolean;
  listenUnavailable?: string;
  checkFailed?: string;
};

export type GuestRoomCounts = { participantCount: number; guestCount: number };

export type GuestCredentials = {
  streamApiKey: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

type Body = Record<string, unknown>;

async function readBody(res: Response): Promise<Body> {
  const data: unknown = await res.json().catch(() => null);
  return typeof data === 'object' && data !== null ? (data as Body) : {};
}

function stringField(data: Body, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

// The server's own words when it gave any (`message`, or the rate limiter's `error`), then the status.
function serverWords(status: number, body: Body): string {
  return `${stringField(body, 'message') ?? stringField(body, 'error') ?? 'The server returned an error.'} (HTTP ${status})`;
}

export async function getPublicRoom(): Promise<LiveState> {
  try {
    const res = await authedFetch('/api/chyme/public/room');
    const body = await readBody(res);
    if (!res.ok || body.ok !== true) return { isLive: false, participantCount: 0, guestCount: 0, checkFailed: serverWords(res.status, body) };
    return {
      isLive: body.isLive === true,
      participantCount: typeof body.participantCount === 'number' ? body.participantCount : 0,
      guestCount: typeof body.guestCount === 'number' ? body.guestCount : 0,
      roomName: stringField(body, 'roomName'),
      guestListenAllowed: body.guestListenAllowed === true,
      listenUnavailable: stringField(body, 'listenUnavailable'),
    };
  } catch (error) {
    return { isLive: false, participantCount: 0, guestCount: 0, checkFailed: error instanceof Error ? error.message : 'The request did not complete.' };
  }
}

// Can't tell counts as still live, so a network blip does not hide a room that is up.
export async function isRoomStillLive(): Promise<boolean> {
  try {
    const res = await authedFetch('/api/chyme/public/room');
    if (!res.ok) return true;
    const body = await readBody(res);
    return body.ok ? body.isLive === true : true;
  } catch {
    return true;
  }
}

export function countsFrom(body: Body): GuestRoomCounts | null {
  const { participantCount, guestCount } = body;
  if (typeof participantCount !== 'number' || typeof guestCount !== 'number') return null;
  return { participantCount, guestCount };
}

export class GuestListenRefused extends Error {
  readonly roomGone: boolean;
  constructor(message: string, roomGone: boolean) {
    super(message);
    this.name = 'GuestListenRefused';
    this.roomGone = roomGone;
  }
}

const POST = { method: 'POST', headers: { 'x-ctf-csrf': '1' } };

// The tap: takes a listening spot and mints this phone's guest Stream identity.
export async function requestGuestListenCredentials(): Promise<{ credentials: GuestCredentials; counts: GuestRoomCounts | null }> {
  const res = await authedFetch('/api/chyme/public/listen', POST);
  const body = await readBody(res);
  if (res.ok && body.ok === true && typeof body.credentials === 'object' && body.credentials !== null) {
    return { credentials: body.credentials as GuestCredentials, counts: countsFrom(body) };
  }
  throw new GuestListenRefused(serverWords(res.status, body), body.isLive === false);
}

// The listener's keepalive. `onRosterGone` runs when the server no longer has this listener.
export function postGuestHeartbeat(onCounts: (_c: GuestRoomCounts) => void, onRosterGone: () => void): void {
  void authedFetch('/api/chyme/public/heartbeat', POST)
    .then(async (res) => {
      const body = await readBody(res);
      if (!res.ok) {
        if (body.code === 'CHYME_GUEST_IDENTITY_MISSING') onRosterGone();
        return;
      }
      const counts = body.ok === true ? countsFrom(body) : null;
      if (counts) onCounts(counts);
    })
    .catch(() => {
      /* no-trace: best-effort keepalive; the next beat reconciles */
    });
}

export function postGuestLeave(): void {
  void authedFetch('/api/chyme/public/leave', POST).catch(() => {
    /* no-trace: best-effort; the presence window lapses the listener anyway */
  });
}

export type ChatState = { kind: 'loading' } | { kind: 'ready'; messages: ChymeMessage[] } | { kind: 'error'; message: string };

export async function readPublicChat(): Promise<ChatState> {
  const res = await authedFetch('/api/chyme/public/messages?limit=50');
  const body = await readBody(res);
  if (!res.ok) return { kind: 'error', message: serverWords(res.status, body) };
  return { kind: 'ready', messages: Array.isArray(body.messages) ? (body.messages as ChymeMessage[]) : [] };
}

// The web's chymeAttendanceLine (lib/chyme/capacity-line.ts).
export function attendanceLine(memberCount: number, guestCount: number): string {
  const members = Math.max(0, memberCount);
  const guests = Math.max(0, guestCount);
  const total = members + guests;
  const m = `${members} ${members === 1 ? 'member' : 'members'}`;
  const g = `${guests} ${guests === 1 ? 'guest' : 'guests'}`;
  if (total === 0) return 'nobody in the room yet';
  if (guests === 0) return `${m} in the room`;
  if (members === 0) return `${g} listening`;
  return `${total} in the room · ${m}, ${g}`;
}
