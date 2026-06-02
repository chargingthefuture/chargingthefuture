import Constants from 'expo-constants';

type MobileRequestIdentity = {
  userId: string;
  username: string;
  role: 'member' | 'admin';
  isApproved: boolean;
};

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

type RuntimeConfig = {
  mobileAppUrl?: string;
  chymeRequestIdentity?: {
    userId?: string;
    username?: string;
    role?: string;
    isApproved?: string | boolean;
  };
};

function getRuntimeConfig(): RuntimeConfig {
  return (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as RuntimeConfig;
}

function getBaseUrl(): string {
  const mobileAppUrl = getRuntimeConfig().mobileAppUrl;
  if (typeof mobileAppUrl === 'string' && mobileAppUrl.trim().length > 0) {
    return mobileAppUrl.trim().replace(/\/$/, '');
  }

  throw new Error('MOBILE_APP_URL is required for Chyme mobile parity.');
}

function normalizeApproved(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value ?? 'approved').trim().toLowerCase();
  return ['1', 'true', 'yes', 'approved'].includes(normalized);
}

export function getChymeMobileIdentity(): MobileRequestIdentity {
  const identity = getRuntimeConfig().chymeRequestIdentity;
  const userId = identity?.userId?.trim();
  const username = identity?.username?.trim();
  const role = identity?.role?.trim().toLowerCase();

  if (!userId || !username) {
    throw new Error('Chyme mobile identity is missing. Configure MOBILE_CTF_USER_ID and MOBILE_CTF_USERNAME.');
  }

  if (role !== 'member' && role !== 'admin') {
    throw new Error('Chyme mobile identity role must be member or admin.');
  }

  return {
    userId,
    username,
    role,
    isApproved: normalizeApproved(identity?.isApproved),
  };
}

function buildIdentityHeaders(identity: MobileRequestIdentity): HeadersInit {
  return {
    'x-ctf-authenticated': 'true',
    'x-ctf-auth-provider': 'mobile-provider-neutral',
    'x-ctf-user-id': identity.userId,
    'x-ctf-username': identity.username,
    'x-ctf-user-role': identity.role,
    'x-ctf-user-approved': identity.isApproved ? 'approved' : 'denied',
  };
}

async function fetchJson<T>(path: string, identity: MobileRequestIdentity, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      ...buildIdentityHeaders(identity),
      ...(options?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : `Network request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function getChymeRoom(identity: MobileRequestIdentity): Promise<ChymeRoomResponse> {
  return fetchJson('/api/chyme/room', identity);
}

export async function getChymeMessages(identity: MobileRequestIdentity): Promise<ChymeMessagesResponse> {
  return fetchJson('/api/chyme/messages?limit=50', identity);
}

export async function postChymeMessage(identity: MobileRequestIdentity, text: string): Promise<ChymeSendResponse> {
  return fetchJson('/api/chyme/messages', identity, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function postChymeJoin(identity: MobileRequestIdentity): Promise<ChymeJoinResponse> {
  return fetchJson('/api/chyme/join', identity, { method: 'POST' });
}

export async function deleteChymeProfile(identity: MobileRequestIdentity): Promise<ChymeDeletionResponse> {
  return fetchJson('/api/account/chyme-profile', identity, { method: 'DELETE' });
}

export async function deleteFullAccount(identity: MobileRequestIdentity): Promise<ChymeDeletionResponse> {
  return fetchJson('/api/account/full-account', identity, { method: 'DELETE' });
}

export type { MobileRequestIdentity };
