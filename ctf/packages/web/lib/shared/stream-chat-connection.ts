'use client';

// One live Stream Chat connection per (apiKey, userId) identity, shared by every surface that
// chats as that identity and torn down only when the last holder lets go.
//
// Why per-identity client instances instead of StreamChat.getInstance(apiKey): each surface chats
// as its own Stream user (`socket-relay-<id>`, `feed-<id>` for the Commons live layer,
// `chyme-<id>`, ...), but getInstance returns ONE singleton per API key. With that shared client,
// whichever surface connected last silently re-authenticated every other mounted surface as its
// own user: the earlier surface kept rendering from cached state, and its next send went out as a
// user who is not a member of that channel — Stream answers 403 and the member sees
// "Message Failed · Unauthorized" (owner reports: SocketRelay Direct Line). Disconnecting one
// surface likewise tore down another surface's live connection. And stream-chat defers its token
// wipe inside disconnectUser (a setTimeout), so a disconnect racing a reconnect on the same
// instance could strip the freshly set token and leave every later call unauthenticated.
//
// Separate instances remove the whole class: no surface can re-authenticate or disconnect another
// identity's connection, and a released instance's deferred token wipe lands on that dead instance
// only — never on its replacement, which is always a brand-new client.
import { StreamChat } from 'stream-chat';

type ConnectionEntry = {
  client: StreamChat;
  count: number;
  ready: Promise<StreamChat>;
};

const connections = new Map<string, ConnectionEntry>();

const keyOf = (apiKey: string, userId: string) => `${apiKey}:${userId}`;

// Returns a client connected as `userId`, creating the connection on first acquire and sharing it
// with every later acquire for the same identity (e.g. two panels on one page). Each successful
// acquire must be balanced by one releaseStreamChatClient with the same apiKey + userId.
export function acquireStreamChatClient(apiKey: string, userId: string, token: string): Promise<StreamChat> {
  const key = keyOf(apiKey, userId);
  const existing = connections.get(key);
  if (existing) {
    existing.count += 1;
    return existing.ready;
  }
  const client = new StreamChat(apiKey);
  const entry: ConnectionEntry = {
    client,
    count: 1,
    ready: client.connectUser({ id: userId }, token).then(() => client),
  };
  // A failed connect must not stick around as a poisoned entry: drop it so the next acquire starts
  // over with a fresh client. Holders see the same rejection and surface their own error state.
  entry.ready.catch(() => {
    if (connections.get(key) === entry) {
      connections.delete(key);
    }
  });
  connections.set(key, entry);
  return entry.ready;
}

// Balances one acquire. When the last holder releases, the identity's own client instance is
// disconnected — other identities' connections are untouched by construction.
export function releaseStreamChatClient(apiKey: string, userId: string): void {
  const entry = connections.get(keyOf(apiKey, userId));
  if (!entry) {
    return;
  }
  entry.count -= 1;
  if (entry.count <= 0) {
    connections.delete(keyOf(apiKey, userId));
    // Wait for the connect to settle before tearing down, so a quick mount/unmount never leaves a
    // half-open connection behind. The instance is never reused after this.
    void entry.ready.then((client) => client.disconnectUser()).catch(() => {});
  }
}
