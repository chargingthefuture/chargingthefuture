import { authedFetchJson } from '../../auth/authedFetch';

export function chymeHandle(username: string | null, userId: string): string {
  return username ? '@' + username : 'user-' + userId.slice(0, 8);
}

type ChymeParticipant = {
  userId: string;
  username: string | null;
  role: 'speaker' | 'listener';
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

type ChymeJoinResponse = {
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function postChymeJoin(): Promise<ChymeJoinResponse> {
  return authedFetchJson('/api/chyme/join', { method: 'POST' });
}

export async function deleteChymeProfile(): Promise<ChymeDeletionResponse> {
  return authedFetchJson('/api/account/chyme-profile', { method: 'DELETE' });
}

export async function deleteFullAccount(): Promise<ChymeDeletionResponse> {
  return authedFetchJson('/api/account/full-account', { method: 'DELETE' });
}
