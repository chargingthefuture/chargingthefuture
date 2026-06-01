import { Platform } from 'react-native';

// Survivor Hub home channel (mobile). Mirrors the web routes under
// ctf/packages/web/app/api/hub/messages: one blended, feed-backed `community` channel
// interleaving admin announcements, AI Q&A answers, and peer-to-peer community posts.
// Reads via GET /api/hub/messages; sending creates a peer-to-peer community post via
// POST /api/hub/messages (CSRF-guarded with the x-ctf-csrf header, same as the feed client).
export const HUB_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/hub'
    : 'http://localhost:3000/api/hub';

// One message in the blended Hub stream. Matches lib/hub/types HubMessage on the web side.
// `displayName` is "Survivor Hub" for announcements and AI Q&A, "Community member" for peer posts.
export type HubMessage = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  text: string;
  sentAtIso: string;
};

export type HubMessagesResponse = {
  channelId: string;
  messages: HubMessage[];
};

// The server returns the blended stream oldest-first (ready for a chat view).
export async function fetchHubMessages(): Promise<HubMessagesResponse> {
  const res = await fetch(`${HUB_API_BASE}/messages`);
  if (!res.ok) {
    throw new Error(`Hub messages request failed: ${res.status}`);
  }
  const data = (await res.json()) as HubMessagesResponse;
  return data;
}

export type HubSendResult = {
  ok: true;
  message: HubMessage;
};

// Sending from the composer creates a peer-to-peer community post. Mirrors the web POST contract:
// the x-ctf-csrf header is required, and the server normalizes the new post to the same public
// author shape the polled copy uses so the optimistic send and the polled copy dedup cleanly.
export async function sendHubMessage(text: string): Promise<HubSendResult> {
  const res = await fetch(`${HUB_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('You are posting too quickly. Wait a moment and try again.');
    }
    if (res.status === 422) {
      throw new Error('That post was held back by content moderation.');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('Sign in to post to the community.');
    }
    throw new Error(`Unable to send message: ${res.status}`);
  }

  return (await res.json()) as HubSendResult;
}
