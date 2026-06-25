import webpush from 'web-push';
import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

// Web Push delivery (issue #808 task 5). The first caller is the Foundation instant-call ring: when a
// member rings a provider, ringInstantCall calls sendWebPushToUser so the provider's device wakes even
// with the app closed. The in-app poll remains the fallback; push only augments it.
//
// This module is deliberately user-global, not Foundation-specific, so any plugin can reuse it. It stores
// subscriptions in the user-global push_subscriptions table (kind 'web' today; 'expo' is reserved for the
// deferred Android native-push work on the #808 Android parity ticket).
//
// Graceful no-op contract (critical): the VAPID server keys are read from env. When they are unset — dev,
// CI, or before the owner provisions them — every send is a logged no-op and never throws, so builds,
// tests, and the call flow keep working. Mirrors resolveStreamCredentials' "return null and degrade" shape.

export type WebPushKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type SaveWebPushSubscriptionInput = {
  userId: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  userAgent?: string | null;
};

export type WebPushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// Resolve the VAPID keys from env, or null when any are missing. The public key is NOT secret and is
// served to the client to subscribe; the private key is server-only and is never logged or returned to a
// client. Trim like resolveStreamCredentials so accidental whitespace in a secret store does not break it.
export function resolveWebPushKeys(): WebPushKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

// The public VAPID key the browser needs to create a subscription. Safe to expose. Empty string when push
// is not configured, so the client can render a clear "alerts unavailable" state instead of failing.
export function getWebPushPublicKey(): string {
  return resolveWebPushKeys()?.publicKey ?? '';
}

// Upsert a device's Web Push subscription on (user_id, endpoint): a device re-subscribing refreshes its
// keys rather than duplicating. user_agent is a short, non-identifying device label.
export async function saveWebPushSubscription(input: SaveWebPushSubscriptionInput): Promise<void> {
  await queryDb(
    `
      INSERT INTO push_subscriptions (user_id, kind, endpoint, p256dh, auth, user_agent, last_used_at)
      VALUES ($1, 'web', $2, $3, $4, $5, NULL)
      ON CONFLICT (user_id, endpoint)
      DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent
    `,
    [input.userId, input.endpoint, input.p256dh, input.auth, input.userAgent ?? null],
  );
}

// Remove one device's subscription (the member turned alerts off on that device, or the browser revoked
// it). Scoped to the owner so a member can only delete their own rows.
export async function deleteWebPushSubscription(input: { userId: string; endpoint: string }): Promise<void> {
  await queryDb(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [input.userId, input.endpoint],
  );
}

type SubscriptionRow = {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

// Drop a subscription the push service has reported as gone (404/410). Best-effort: a delete failure here
// must not mask the original send result.
async function pruneDeadSubscription(userId: string, endpoint: string): Promise<void> {
  try {
    await deleteWebPushSubscription({ userId, endpoint });
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'web_push_prune_dead' });
  }
}

// Send a Web Push to every subscription a user owns. Best-effort and self-contained: it never throws, so a
// caller (e.g. ringInstantCall) can fire-and-forget without the push affecting its own outcome.
//   - VAPID unset: logged no-op, returns immediately.
//   - per-subscription 404/410: that dead subscription is deleted; other devices still get the push.
// Secrets policy: never logs key material; endpoints are sensitive too, so only a count is logged, never
// the endpoint URL itself.
export async function sendWebPushToUser(userId: string, payload: WebPushPayload): Promise<void> {
  const keys = resolveWebPushKeys();
  if (!keys) {
    // No-op when unconfigured. Visible in logs so an operator can see push was skipped, with no secrets.
    console.info(`[web-push] skipped: VAPID not configured (userId=${userId})`);
    return;
  }

  let rows: SubscriptionRow[];
  try {
    const result = await queryDb<SubscriptionRow>(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 AND kind = 'web'`,
      [userId],
    );
    rows = result.rows;
  } catch (error) {
    reportError(error, { area: 'notifications', op: 'web_push_load_subscriptions' });
    return;
  }

  if (rows.length === 0) {
    return;
  }

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  const serialized = JSON.stringify(payload);
  const usedEndpoints: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      if (!row.p256dh || !row.auth) {
        // A subscription without its encryption keys cannot receive an encrypted push; skip it.
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          serialized,
        );
        usedEndpoints.push(row.endpoint);
      } catch (error) {
        const statusCode = (error as { statusCode?: number } | null)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await pruneDeadSubscription(userId, row.endpoint);
          return;
        }
        // Do not include the endpoint (sensitive) in the report; only the status code.
        reportError(error, { area: 'notifications', op: 'web_push_send', extra: { statusCode } });
      }
    }),
  );

  if (usedEndpoints.length > 0) {
    try {
      await queryDb(
        `UPDATE push_subscriptions SET last_used_at = NOW() WHERE user_id = $1 AND endpoint = ANY($2::text[])`,
        [userId, usedEndpoints],
      );
    } catch (error) {
      reportError(error, { area: 'notifications', op: 'web_push_stamp_last_used' });
    }
  }
}
