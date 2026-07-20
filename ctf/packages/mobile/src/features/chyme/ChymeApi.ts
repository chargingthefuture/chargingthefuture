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
