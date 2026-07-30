import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import { deletePushSubscriptionByEndpoint, type WebPushPayload } from './push';

// Expo (Android native) push delivery (issue #884). The first caller is the Foundation instant-call ring:
// when a member rings a provider, dispatchRingDelivery calls sendExpoPushToUser alongside sendWebPushToUser
// so an Android device that turned on "call alerts" is woken even with the app closed. The in-app poll
// remains the fallback; push only augments it.
//
// This mirrors the web push module's contract exactly:
//   - It stores tokens in the SAME user-global push_subscriptions table, with kind 'expo' (the token is the
//     endpoint/identity; p256dh/auth are null). saveExpoPushSubscription / deletePushSubscriptionByEndpoint
//     handle storage (deletion is kind-agnostic — it matches on endpoint).
//   - Graceful no-op (critical): an Expo access token MAY be required to send (for an Expo project with
//     "Enhanced Security for Push Notifications" turned on). It is read from EXPO_ACCESS_TOKEN. When it is
//     unset, sends still work for projects without that setting; the request simply carries no auth header.
//     Either way sendExpoPushToUser NEVER throws — a push failure can never affect the ring.
//   - On a 'DeviceNotRegistered' Expo receipt, the dead subscription is pruned, exactly like a web 404/410.
//   - Secrets policy: the Expo token (device) and EXPO_ACCESS_TOKEN (secret) are never logged; only counts.

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export type SaveExpoPushSubscriptionInput = {
  userId: string;
  // The device's Expo push token (e.g. "ExponentPushToken[...]"). Stored as the endpoint/identity so it
  // reuses the same (user_id, endpoint) uniqueness as web subscriptions; a re-register refreshes the row.
  token: string;
  userAgent?: string | null;
};

// Upsert a device's Expo (Android native) push subscription (issue #884). Mirrors saveWebPushSubscription
// but with kind 'expo': the Expo push token is the identity, so it is stored in the endpoint column and
// p256dh/auth are null (an Expo push is not the encrypted Web Push envelope). The (user_id, endpoint)
// uniqueness means a device re-registering refreshes its row rather than duplicating, and the same
// deletion-registry wiring that removes web rows on account/service deletion removes these too (the
// registry deletes every push_subscriptions row by user_id, regardless of kind).
export async function saveExpoPushSubscription(input: SaveExpoPushSubscriptionInput): Promise<void> {
  await queryDb(
    `
      INSERT INTO push_subscriptions (user_id, kind, endpoint, p256dh, auth, user_agent, last_used_at)
      VALUES ($1, 'expo', $2, NULL, NULL, $3, NULL)
      ON CONFLICT (user_id, endpoint)
      DO UPDATE SET
        kind = 'expo',
        p256dh = NULL,
        auth = NULL,
        user_agent = EXCLUDED.user_agent
    `,
    [input.userId, input.token, input.userAgent ?? null],
  );
}

// Read the optional Expo access token from env, trimmed, or null. It is server-only and secret; never
// logged or returned to a client. It is NOT always required: an Expo project without "Enhanced Security
// for Push Notifications" accepts unauthenticated sends, so a null here is a valid configuration, not an
// error. Document it like the VAPID keys (123-environment-configuration-rules).
function resolveExpoAccessToken(): string | null {
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

type ExpoSubscriptionRow = { endpoint: string };

// Drop a token Expo has reported as gone ('DeviceNotRegistered'). Best-effort: a delete failure here must
// not mask the original send result. Reuses the kind-agnostic deletePushSubscriptionByEndpoint (by endpoint).
async function pruneDeadExpoSubscription(userId: string, endpoint: string): Promise<void> {
  try {
    await deletePushSubscriptionByEndpoint({ userId, endpoint });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'expo_push_prune_dead' });
  }
}

// The shape of one Expo push receipt in the /push/send response `data` array. Only the fields we act on
// are typed; everything else is ignored.
type ExpoPushTicket = {
  status?: 'ok' | 'error';
  details?: { error?: string };
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string;
  priority: string;
  channelId: string;
};

// Load a user's Expo device endpoints. Returns [] when there are none, or null on a DB error (the caller
// treats null as "give up quietly" — push is best-effort).
async function loadExpoEndpoints(userId: string): Promise<ExpoSubscriptionRow[] | null> {
  try {
    const result = await queryDb<ExpoSubscriptionRow>(
      `SELECT endpoint FROM push_subscriptions WHERE user_id = $1 AND kind = 'expo'`,
      [userId],
    );
    return result.rows;
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'expo_push_load_subscriptions' });
    return null;
  }
}

// POST the batch to Expo and return its receipts, or null on a network error / non-OK response (already
// reported). Never logs the body (it can echo tokens); only the status.
async function postExpoBatch(messages: ExpoMessage[], accessToken: string | null): Promise<ExpoPushTicket[] | null> {
  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      reportError(new Error(`Expo push send failed: ${response.status}`), {
        area: 'notifications',
        op: 'expo_push_send',
        extra: { status: response.status },
      });
      return null;
    }
    const parsed = (await response.json().catch(() => null)) as { data?: unknown } | null;
    return Array.isArray(parsed?.data) ? (parsed.data as ExpoPushTicket[]) : [];
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'expo_push_send' });
    return null;
  }
}

// Act on one receipt. Returns the endpoint when the push landed (so its last_used can be stamped), or null
// when it errored. A 'DeviceNotRegistered' token is dead and is pruned; other errors are reported (no token
// logged). A non-object receipt (e.g. a bare string on an error response) is treated as a non-delivery.
async function handleExpoReceipt(userId: string, endpoint: string, ticket: ExpoPushTicket): Promise<string | null> {
  if (!ticket || typeof ticket !== 'object') return null;
  if (ticket.status !== 'error') return endpoint;
  const reason = ticket.details?.error ?? 'unknown';
  if (reason === 'DeviceNotRegistered') {
    await pruneDeadExpoSubscription(userId, endpoint);
  } else {
    reportError(new Error('Expo push receipt error'), {
      area: 'notifications',
      op: 'expo_push_receipt',
      extra: { error: reason },
    });
  }
  return null;
}

// Stamp last_used_at on the endpoints that received the push. Best-effort.
async function stampExpoLastUsed(userId: string, endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  try {
    await queryDb(
      `UPDATE push_subscriptions SET last_used_at = NOW() WHERE user_id = $1 AND endpoint = ANY($2::text[])`,
      [userId, endpoints],
    );
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'expo_push_stamp_last_used' });
  }
}

// Send an Expo push to every Expo device a user owns (issue #884). Best-effort and self-contained: it never
// throws, so a caller (e.g. dispatchRingDelivery) can fire-and-forget without the push affecting its own
// outcome.
//   - No Expo devices: returns immediately.
//   - A 'DeviceNotRegistered' receipt: that dead token is deleted; other devices still get the push.
// Secrets policy: never logs the device token or the Expo access token; only counts.
export async function sendExpoPushToUser(userId: string, payload: WebPushPayload): Promise<void> {
  const rows = await loadExpoEndpoints(userId);
  if (!rows || rows.length === 0) {
    return;
  }

  const accessToken = resolveExpoAccessToken();
  if (!accessToken) {
    // Not an error: an Expo project without enhanced push security accepts unauthenticated sends. Logged
    // so an operator can see the send went out without an access token. No user identifier is logged — a
    // user id is PII and must not land in log aggregation (secrets policy); only the device count.
    console.info(`[expo-push] sending without EXPO_ACCESS_TOKEN (devices=${rows.length})`);
  }

  // One batch request to Expo: an array of messages, one per device token.
  const messages: ExpoMessage[] = rows.map((row) => ({
    to: row.endpoint,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: 'default',
    priority: 'high',
    channelId: 'foundation-calls',
  }));

  const receipts = await postExpoBatch(messages, accessToken);
  if (!receipts) {
    return;
  }

  // Receipts come back positionally: receipts[i] is the ticket for messages[i], and thus for rows[i]. That
  // alignment only holds when every message is accepted in the one batch. If the counts differ (a
  // malformed/truncated body, or partial acceptance), the arrays are misaligned and processing them by
  // index would prune or stamp the WRONG token — so bail out rather than act on a misaligned response.
  if (receipts.length !== messages.length) {
    reportError(new Error('Expo push receipt count mismatch'), {
      area: 'notifications',
      op: 'expo_push_send',
      extra: { sent: messages.length, received: receipts.length },
    });
    return;
  }

  // Collect the successfully-sent endpoints from the Promise.all return value rather than pushing into a
  // shared array, so the result never depends on callback interleaving.
  const results = await Promise.all(
    receipts.map((ticket, index) => {
      const endpoint = rows[index]?.endpoint;
      return endpoint ? handleExpoReceipt(userId, endpoint, ticket) : Promise.resolve(null);
    }),
  );
  const usedEndpoints = results.filter((endpoint): endpoint is string => endpoint !== null);
  await stampExpoLastUsed(userId, usedEndpoints);
}
