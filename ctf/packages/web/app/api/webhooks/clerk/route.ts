import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { markFullAccountDeletionRequested } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { deleteAllAccountData } from 'lib/account/deletion-orchestrator';
import { runWithForcedPool, queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';

// Clerk webhook receiver. Clerk deliveries are signed with svix; we verify the signature ourselves
// (this Clerk version ships no verify helper and svix is not a dependency) using the endpoint's
// signing secret. The only event we ACT on is `user.deleted`: when a member deletes their Clerk
// account directly (Clerk's hosted "Delete account"), Clerk removes the identity but the app never
// hears about it, leaving every plugin's data orphaned on a dead id — and the v2 Quora port then
// re-approves + re-rewards them. This runs the SAME cleanup as the app's own Delete Account flow so a
// Clerk-side deletion is handled identically: it records the deletion, queues the ServiceCredits
// reclaim, and deletes each plugin's data via the deletion registry/orchestrator.
//
// It never calls Clerk deleteUser (the identity is already gone) and is idempotent: the app's own
// delete flow calls Clerk deleteUser, which also fires this webhook, so if the account was already
// processed we skip (an `account_deletion_events` row already exists) rather than double-reclaim.
//
// Inert until `CLERK_WEBHOOK_SIGNING_SECRET` is set in the app runtime (returns 503), so it cannot
// fire before the Clerk dashboard endpoint + the secret are configured.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_ACTOR_ID = 'clerk-user-deleted-webhook';
// Reject deliveries whose signed timestamp is too far from now (replay protection). svix's own client
// uses a 5-minute window.
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

// Verify an svix signature. The secret is `whsec_<base64>`; the signed content is
// `${id}.${timestamp}.${body}` and the header carries one or more space-separated `v1,<base64sig>`
// entries (a secret rotation can produce several). A constant-time compare guards against timing leaks.
function verifySvixSignature(
  signingSecret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignatureHeader: string,
  rawBody: string,
): boolean {
  const secretBase64 = signingSecret.startsWith('whsec_') ? signingSecret.slice('whsec_'.length) : signingSecret;
  let key: Buffer;
  try {
    key = Buffer.from(secretBase64, 'base64');
  } catch {
    return false;
  }
  const expected = createHmac('sha256', key).update(`${svixId}.${svixTimestamp}.${rawBody}`).digest('base64');
  const expectedBuf = Buffer.from(expected);
  return svixSignatureHeader.split(' ').some((entry) => {
    const commaIndex = entry.indexOf(',');
    const candidate = commaIndex >= 0 ? entry.slice(commaIndex + 1) : entry;
    if (!candidate) return false;
    const candidateBuf = Buffer.from(candidate);
    return candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf);
  });
}

type ClerkWebhookEvent = { type?: string; data?: { id?: unknown } };

// Configuration presence + full svix verification for an incoming delivery, in the original order:
// require the signing secret (503 inert), read the raw body (never parse before verifying), require
// the three svix headers, enforce the timestamp tolerance, then verify the signature. Returns a ready
// error response or the verified raw body. Each status code and code string is unchanged from the
// inline version.
async function verifyWebhookDelivery(
  request: Request,
  signingSecret: string | undefined,
): Promise<{ error: NextResponse } | { rawBody: string }> {
  if (!signingSecret || signingSecret.trim().length === 0) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'clerk_webhook_not_configured', message: 'CLERK_WEBHOOK_SIGNING_SECRET is not set in the app runtime.' },
        { status: 503 },
      ),
    };
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  // The raw body text is what the signature covers — never parse before verifying.
  const rawBody = await request.text();

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { error: NextResponse.json({ ok: false, code: 'missing_signature_headers' }, { status: 400 }) };
  }

  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { error: NextResponse.json({ ok: false, code: 'timestamp_out_of_tolerance' }, { status: 400 }) };
  }

  if (!verifySvixSignature(signingSecret, svixId, svixTimestamp, svixSignature, rawBody)) {
    return { error: NextResponse.json({ ok: false, code: 'invalid_signature' }, { status: 401 }) };
  }

  return { rawBody };
}

export async function POST(request: Request) {
  const verification = await verifyWebhookDelivery(request, process.env.CLERK_WEBHOOK_SIGNING_SECRET);
  if ('error' in verification) {
    return verification.error;
  }
  const { rawBody } = verification;

  let event: ClerkWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_json' }, { status: 400 });
  }

  // Acknowledge every other event type so Clerk does not retry deliveries we intentionally ignore.
  if (event.type !== 'user.deleted') {
    return NextResponse.json({ ok: true, ignored: event.type ?? 'unknown' });
  }

  const userId = typeof event.data?.id === 'string' ? event.data.id.trim() : '';
  if (!userId) {
    return NextResponse.json({ ok: true, ignored: 'user.deleted_without_id' });
  }

  try {
    const outcome = await runWithForcedPool('public', async () => {
      // Idempotency guard: the app's own Delete Account flow calls Clerk deleteUser, which also fires
      // this webhook. If an account-scope deletion event already exists, the data is gone — skip so we
      // do not write a duplicate event or re-queue the ServiceCredits reclaim.
      const existing = await queryDb<{ one: number }>(
        `SELECT 1 AS one FROM account_deletion_events WHERE user_id = $1 AND scope = 'account' LIMIT 1`,
        [userId],
      );
      if (existing.rows.length > 0) {
        return { skipped: true as const, tablesAffected: 0 };
      }
      const reclaim = await markFullAccountDeletionRequested(userId);
      const deletion = await deleteAllAccountData(userId, reclaim.requestedAtIso);
      return { skipped: false as const, tablesAffected: deletion.tables.length };
    });

    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: WEBHOOK_ACTOR_ID,
      status: 'allow',
      reason: 'clerk_user_deleted_webhook',
      target: { scope: 'account', userId, source: 'clerk_webhook', skipped: String(outcome.skipped) },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, userId, ...outcome });
  } catch (error) {
    reportError(error, { area: 'account', op: 'clerk_user_deleted_webhook' });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: WEBHOOK_ACTOR_ID,
      status: 'allow',
      reason: 'clerk_user_deleted_webhook',
      target: { scope: 'account', userId, source: 'clerk_webhook' },
      result: 'failure',
      errorCategory: 'persistence_error',
    });
    // 500 so Clerk retries the delivery.
    return NextResponse.json({ ok: false, code: 'clerk_webhook_processing_failed' }, { status: 500 });
  }
}
