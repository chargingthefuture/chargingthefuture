// Client-side live layer for the mobile Commons (Survivor Hub home/community chat). Mirrors the web
// helper at ctf/packages/web/lib/hub/live-stream.ts. The Commons keeps its own custom design and its
// own GET /api/hub/messages history; this only opens a Stream Chat connection beneath that UI so new
// posts arrive immediately (instead of waiting for the poll) and members see a typing indicator.
// Everything here is best-effort: if Stream is not configured (POST /api/hub/join returns
// `configured: false`) or any step fails, the caller silently stays on polling and the chat keeps
// working.
import { StreamChat } from 'stream-chat';
import type { Channel } from 'stream-chat';
import { authedFetch } from '../../auth/authedFetch';

// The credentials POST /api/hub/join mints so the client can open a live connection to the shared
// `ctf-feed-community` channel. Matches the web HubJoinResponse `configured: true` branch.
export type HubLiveCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

// The response shape of POST /api/hub/join. `configured: true` carries real credentials minted
// server-side; `configured: false` means Stream is not set up in this environment, so the caller
// must skip the live connection and stay on polling.
type HubJoinResponse =
  | {
      ok: true;
      configured: true;
      streamApiKey: string;
      streamChannelId: string;
      streamUserId: string;
      streamToken: string;
    }
  | {
      ok: true;
      configured: false;
    };

// A member currently typing in the Commons, identified by Stream user id and a display name to
// render ("X is typing…"). The local member is never included.
export type HubTypingUser = {
  id: string;
  name: string;
};

export type HubLiveHandlers = {
  // Fired when a new message lands on the channel or the connection recovers, so the caller can pull
  // fresh history. Debouncing/coalescing is the caller's concern.
  onActivity: () => void;
  // Fired with the current set of other members typing (already excluding the local member).
  onTypingChange: (_typing: HubTypingUser[]) => void;
};

// A live connection handle the caller holds for the life of the chat mount. `sendTyping` /
// `stopTyping` emit typing events as the member writes; `disconnect` tears the connection down.
export type HubLiveConnection = {
  sendTyping: () => void;
  stopTyping: () => void;
  disconnect: () => Promise<void>;
};

// Call POST /api/hub/join through authedFetch (the Clerk bearer token attached) and return the
// live credentials. Returns null when Stream is not configured or the call fails — the caller then
// stays on polling. The hub access gate is enforced server-side; a 401/403 simply yields null here.
export async function fetchHubJoin(): Promise<HubLiveCredentials | null> {
  try {
    const res = await authedFetch('/api/hub/join', { method: 'POST' });
    if (!res.ok) return null;
    const data = (await res.json()) as HubJoinResponse;
    if (!data.ok || !data.configured) return null;
    return {
      streamApiKey: data.streamApiKey,
      streamToken: data.streamToken,
      streamUserId: data.streamUserId,
      streamChannelId: data.streamChannelId,
    };
  } catch {
    return null;
  }
}

function readTypingUsers(channel: Channel, selfId: string): HubTypingUser[] {
  // channel.state.typing is keyed by user id; each value carries the typing event with its user.
  const typingState = channel.state.typing ?? {};
  const users: HubTypingUser[] = [];
  for (const event of Object.values(typingState)) {
    const user = event.user;
    if (!user || user.id === selfId) continue;
    const name = typeof user.name === 'string' && user.name.trim().length > 0 ? user.name : 'Someone';
    users.push({ id: user.id, name });
  }
  return users;
}

// Open a live Stream Chat connection to the Commons community channel and wire the activity/typing
// handlers. Resolves to a connection handle on success, or null if anything fails — in which case the
// caller stays on polling. The handle's disconnect must be called on unmount.
export async function connectHubLive(
  credentials: HubLiveCredentials,
  handlers: HubLiveHandlers,
): Promise<HubLiveConnection | null> {
  let client: StreamChat | null = null;
  try {
    client = StreamChat.getInstance(credentials.streamApiKey);
    await client.connectUser({ id: credentials.streamUserId }, credentials.streamToken);

    const channel = client.channel('messaging', credentials.streamChannelId);
    await channel.watch();

    const selfId = credentials.streamUserId;

    const emitTyping = () => {
      handlers.onTypingChange(readTypingUsers(channel, selfId));
    };

    // New posts (and any restored connection) trigger a history refresh so the custom Commons cards
    // update immediately. The handler swallows its own errors; the caller's poll is the backstop.
    const onMessageNew = () => handlers.onActivity();
    const onRecovered = () => handlers.onActivity();
    const onTypingStart = () => emitTyping();
    const onTypingStop = () => emitTyping();

    channel.on('message.new', onMessageNew);
    client.on('connection.recovered', onRecovered);
    channel.on('typing.start', onTypingStart);
    channel.on('typing.stop', onTypingStop);

    let typingActive = false;

    return {
      sendTyping: () => {
        typingActive = true;
        // keystroke() debounces server typing events for us; failures are non-fatal.
        void channel.keystroke().catch(() => undefined);
      },
      stopTyping: () => {
        if (!typingActive) return;
        typingActive = false;
        void channel.stopTyping().catch(() => undefined);
      },
      disconnect: async () => {
        try {
          channel.off('message.new', onMessageNew);
          client?.off('connection.recovered', onRecovered);
          channel.off('typing.start', onTypingStart);
          channel.off('typing.stop', onTypingStop);
          if (typingActive) {
            await channel.stopTyping().catch(() => undefined);
          }
        } finally {
          await client?.disconnectUser().catch(() => undefined);
        }
      },
    };
  } catch {
    // Any failure (connect, watch, or otherwise) leaves the caller on polling. Best-effort cleanup of
    // a partially-opened client so we never leak a connection.
    if (client) {
      await client.disconnectUser().catch(() => undefined);
    }
    return null;
  }
}
