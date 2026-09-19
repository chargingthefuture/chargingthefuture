import { authedFetchJson } from '../../auth/authedFetch';

export function chymeHandle(username: string | null, userId: string): string {
  return username ? '@' + username : 'user-' + userId.slice(0, 8);
}

type ChymeParticipant = {
  userId: string;
  username: string | null;
  role: 'speaker' | 'listener';
  // Server-persisted raised hand. Rides on the member's presence row (set by POST /api/chyme/hand),
  // so it stays true until the member lowers their hand or leaves — unlike a transient Stream
  // reaction. The audio room polls GET /api/chyme/room to show every other member's raised hand.
  handRaised: boolean;
};

type ChymeRoomResponse = {
  roomId: string;
  roomName: string;
  roomKey: string;
  callActive: boolean;
  participants: ChymeParticipant[];
  // How full the room is against the cap in force (the cap moves with the Stream quota band).
  capacity: { current: number; max: number };
  // What the Stream quota policy says right now: a member-facing line (null when nothing to say)
  // and the two flags for the actions it can pause. No meter numbers here (rule 110).
  quota: {
    band: 'green' | 'yellow' | 'orange' | 'red';
    notice: string | null;
    guestListenAllowed: boolean;
    backChannelAllowed: boolean;
  };
};

type ChymeMessagesResponse = {
  roomKey: string;
  messages: Array<{
    id: string;
    userId: string;
    username: string | null;
    text: string;
    sentAtIso: string;
  }>;
};

type ChymeSendResponse = {
  ok: true;
  message: {
    id: string;
    userId: string;
    username: string | null;
    text: string;
    sentAtIso: string;
  };
};

export type ChymeJoinResponse = {
  ok: true;
  roomId: string;
  roomKey: string;
  streamApiKey: string;
  streamChannelId: string;
  streamUserId: string;
  streamToken: string;
};

type ChymeDeletionResponse = {
  ok: true;
  scope: 'service' | 'account';
  status: 'requested' | 'processing' | 'completed' | 'failed';
  requestedAtIso: string;
};

// Identity is no longer passed in: the user is whoever the verified Clerk
// session token (Authorization: Bearer) resolves to on the backend. All requests
// go through authedFetchJson, which attaches that token.

export async function getChymeRoom(): Promise<ChymeRoomResponse> {
  return authedFetchJson('/api/chyme/room');
}

export async function getChymeMessages(): Promise<ChymeMessagesResponse> {
  return authedFetchJson('/api/chyme/messages?limit=50');
}

export async function postChymeMessage(text: string): Promise<ChymeSendResponse> {
  return authedFetchJson('/api/chyme/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ text }),
  });
}

// Delete the signed-in member's OWN room chat message. Author-only is enforced server-side
// (DELETE /api/chyme/messages/[messageId] → 403 for someone else's message, 404 for a missing id,
// 400 for a non-UUID). CSRF-guarded. There is no in-place edit: the client's "Edit" loads the text
// back into the composer and calls this delete, then the member sends a fresh message (new id/time).
export async function deleteChymeMessage(messageId: string): Promise<{ ok: true }> {
  return authedFetchJson(`/api/chyme/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    headers: { 'x-ctf-csrf': '1' },
  });
}

export async function postChymeJoin(): Promise<ChymeJoinResponse> {
  return authedFetchJson('/api/chyme/join', {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
}

// Presence heartbeat. The audio room pings this on a 35s interval while joined so the member's
// last_seen_at stays fresh inside the 45s presence window and they keep counting as present.
// Matches the web room's heartbeat ping.
export async function postChymeHeartbeat(): Promise<{ ok: true }> {
  return authedFetchJson('/api/chyme/heartbeat', {
    method: 'POST',
    headers: { 'x-ctf-csrf': '1' },
  });
}

// Persist the caller's raise/lower hand on their presence row so everyone in the room keeps seeing
// it until it's lowered (or they leave). Stream reactions are transient and auto-clear, so they
// cannot carry this state. Mirrors the web room's POST /api/chyme/hand call.
export async function postChymeHand(raised: boolean): Promise<{ ok: true }> {
  return authedFetchJson('/api/chyme/hand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ raised }),
  });
}

type ChymeTipResponse = {
  ok: true;
  transaction: { id: string; fromUserId: string; toUserId: string; amount: number; status: string };
};

// Send ServiceCredits peer-to-peer to another room participant (origin_plugin 'chyme'). The transfer
// delivers immediately; on failure the backend's message (e.g. insufficient balance) is surfaced.
export async function postChymeTip(toUserId: string, amount: number, message?: string): Promise<ChymeTipResponse> {
  return authedFetchJson('/api/chyme/service-credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ toUserId, amount, ...(message && message.trim().length > 0 ? { message: message.trim() } : {}) }),
  });
}

// --- Back Channel (free 1:1 audio sidebar inside a live Chyme room, spec #1746) ---------------------
// Casual 1:1 audio with another member who is in the same room right now. Consent-gated (invite/accept),
// block-aware, room-bound, no credits, no history. Mirrors the web client exactly.

export type ChymeBackChannelState = {
  incomingInvite: { callId: string; fromUserId: string; fromUsername: string | null } | null;
  outgoingInvite: { callId: string; toUserId: string; toUsername: string | null } | null;
  activeCall: {
    callId: string;
    streamCallId: string;
    role: 'initiator' | 'recipient';
    otherUserId: string;
    otherUsername: string | null;
    startedAtIso: string;
  } | null;
};

export type ChymeBackChannelJoinResponse = {
  ok: true;
  callId: string;
  streamCallId: string;
  streamApiKey: string;
  streamUserId: string;
  streamToken: string;
};

export async function getBackChannelState(): Promise<ChymeBackChannelState> {
  return authedFetchJson('/api/chyme/back-channel/state');
}

export async function postBackChannelInvite(recipientUserId: string): Promise<{ ok: true; callId: string }> {
  return authedFetchJson('/api/chyme/back-channel/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ recipientUserId }),
  });
}

export async function postBackChannelAccept(callId: string): Promise<ChymeBackChannelJoinResponse> {
  return authedFetchJson('/api/chyme/back-channel/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ callId }),
  });
}

export async function postBackChannelJoin(callId: string): Promise<ChymeBackChannelJoinResponse> {
  return authedFetchJson('/api/chyme/back-channel/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ callId }),
  });
}

export async function postBackChannelDecline(callId: string): Promise<{ ok: true }> {
  return authedFetchJson('/api/chyme/back-channel/decline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ callId }),
  });
}

export async function postBackChannelLeave(callId: string): Promise<{ ok: true }> {
  return authedFetchJson('/api/chyme/back-channel/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ callId }),
  });
}

export async function postBackChannelHeartbeat(callId: string): Promise<{ ok: true }> {
  return authedFetchJson('/api/chyme/back-channel/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    body: JSON.stringify({ callId }),
  });
}

export async function deleteChymeProfile(): Promise<ChymeDeletionResponse> {
  return authedFetchJson('/api/account/chyme-profile', { method: 'DELETE' });
}

export async function deleteFullAccount(): Promise<ChymeDeletionResponse> {
  return authedFetchJson('/api/account/full-account', { method: 'DELETE' });
}

// --- Scheduled rooms, MVP (owner decision, 2026-09-19): what is coming up on the TI Radio guide ---
//
// Chyme reads the guide's own public route (GET /api/ti-radio/guide — open to signed-out visitors,
// so the bearer token is not required, only passed along) and shows the next booked slots on the
// Upcoming tab. No room creation, no room per slot: the guide says when, this room is where.

export type ChymeUpcomingSlot = {
  slotStartIso: string;
  slotEndIso: string;
  isOnAir: boolean;
  title: string;
  hostUsername: string;
};

type GuideSlotPayload = {
  slotStartIso?: unknown;
  slotEndIso?: unknown;
  isOnAir?: unknown;
  booking?: { title?: unknown; hostUsername?: unknown } | null;
};

const UPCOMING_LIMIT = 5;

// One guide entry as an upcoming slot, or null when it is open, malformed, or already over.
function toUpcomingSlot(raw: unknown, nowMs: number): ChymeUpcomingSlot | null {
  const slot = (typeof raw === 'object' && raw !== null ? raw : {}) as GuideSlotPayload;
  const booking = slot.booking;
  if (typeof slot.slotStartIso !== 'string' || typeof slot.slotEndIso !== 'string' || !booking) return null;
  if (typeof booking.title !== 'string' || typeof booking.hostUsername !== 'string') return null;
  if (Date.parse(slot.slotEndIso) <= nowMs) return null;
  return {
    slotStartIso: slot.slotStartIso,
    slotEndIso: slot.slotEndIso,
    isOnAir: slot.isOnAir === true,
    title: booking.title,
    hostUsername: booking.hostUsername,
  };
}

// Booked slots that have not ended yet, soonest first, capped. A malformed entry is skipped rather
// than taking the list down. Mirrors the web room's pickUpcoming.
export function pickUpcomingSlots(slots: unknown[], now: Date, limit: number = UPCOMING_LIMIT): ChymeUpcomingSlot[] {
  const nowMs = now.getTime();
  const picked: ChymeUpcomingSlot[] = [];
  for (const raw of slots) {
    const slot = toUpcomingSlot(raw, nowMs);
    if (!slot) continue;
    picked.push(slot);
    if (picked.length >= limit) break;
  }
  return picked;
}

export async function getChymeUpcoming(): Promise<ChymeUpcomingSlot[]> {
  const payload = await authedFetchJson<{ ok: true; guide?: { slots?: unknown[] } }>('/api/ti-radio/guide');
  return pickUpcomingSlots(payload.guide?.slots ?? [], new Date());
}

// "Today · 2:00 PM – 3:30 PM", in the phone's own timezone. The guide prints the same way.
export function formatUpcomingWhen(startIso: string, endIso: string, now: Date = new Date()): string {
  const start = new Date(startIso);
  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dayOf = (d: Date) => d.toLocaleDateString('en-CA');
  const today = dayOf(now);
  const tomorrow = dayOf(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const startDay = dayOf(start);
  const day =
    startDay === today
      ? 'Today'
      : startDay === tomorrow
        ? 'Tomorrow'
        : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${time(start)} – ${time(new Date(endIso))}`;
}
