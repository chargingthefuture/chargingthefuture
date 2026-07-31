import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { sendWebPushToUser } from 'lib/notifications/push';
import { sendExpoPushToUser } from 'lib/notifications/expo-push';
import { reportError } from 'lib/observability/report';
import { createTransfer, getOrCreateWallet } from 'lib/service-credits/repository';
import {
  FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS,
  FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS,
  FOUNDATION_INSTANT_CALL_RING_LIMIT,
  FOUNDATION_INSTANT_CALL_RING_TIMEOUT_SECONDS,
  FOUNDATION_INSTANT_CALL_RING_WINDOW_SECONDS,
} from './constants';
import { createFoundationCallToken } from './stream';
import type { FoundationInstantCall, FoundationCallRingStatus } from './types';

// Where a notification click and the in-app fallback both land: the Foundation app, where the existing
// incoming-call overlay (the poll) renders answer/decline. Push only wakes the provider to that surface.
const FOUNDATION_INCOMING_CALL_PATH = '/apps/foundation';

// Foundation instant 1:1 call ring/answer lifecycle + per-block billing + ring delivery (issue #808 tasks
// 3, 4 and 5). Audio-only for v1.
//
// State machine (ring_status column on foundation_call_sessions):
//   ringing --answer--> answered (in-call) --end--> ended
//   ringing --decline--> declined (terminal)
//   ringing --timeout(~60s)--> timed_out (terminal)
//   answered --end (either party)--> ended (terminal)
//
// Billing model (task 4): DIRECT per-block transfer, no escrow. The caller (buyer) is always the sender and
// the provider (callee) is always the recipient. The first block is charged on answer; each subsequent
// block is charged by the caller calling extendInstantCall. Every charge uses the canonical createTransfer
// peer-to-peer primitive, which runs in its OWN db transaction and is idempotent on (sender,
// idempotencyKey) -- so a deterministic key per block (...-block-N) makes a retry safe (the original
// transfer replays, no double charge). createTransfer manages its own transaction, so we never nest it
// inside withDbTransaction.
//
// Credit-safety invariants enforced here:
//   - Only answer + extend ever move credits; ringing charges nothing.
//   - The provider's rate + interval are snapshotted onto the row at answer (rate_credits_locked /
//     interval_minutes_locked) and every later charge uses the LOCKED rate, never the live rate.
//   - A block is never charged twice (deterministic ...-block-N key + the blocks_charged guard).
//   - A call never charges beyond authorized_blocks (the buyer-set cap).
//   - On insufficient funds the call ends cleanly and no partial/zero transfer is left behind.
//
// Task 5 (push) replaces the in-app-only ring delivery (see the seam comment in ringInstantCall). The
// module reuses the Direct Line 1:1 thread and the existing participant-only Stream token route; it never
// mints its own token path.

// A clean terminal reason for why an active/ringing call ended, surfaced in the ended-call state and audit.
type FoundationCallEndedReason =
  | 'caller_insufficient_funds'
  | 'paid_window_elapsed'
  | 'block_cap_reached';

type FoundationCallRow = {
  id: string;
  thread_id: string;
  caller_user_id: string | null;
  callee_user_id: string | null;
  ring_status: string;
  stream_call_id: string;
  ring_expires_at: Date | null;
  answered_at: Date | null;
  ended_at: Date | null;
  ended_by_user_id: string | null;
  first_block_charged: boolean;
  rate_credits_locked: number | null;
  interval_minutes_locked: number | null;
  authorized_blocks: number | null;
  blocks_charged: number;
  paid_through_at: Date | null;
  last_transfer_id: string | null;
  ended_reason: string | null;
  created_at: Date;
};

const CALL_ROW_COLUMNS = `
  id::text,
  thread_id::text,
  caller_user_id,
  callee_user_id,
  ring_status,
  stream_call_id,
  ring_expires_at,
  answered_at,
  ended_at,
  ended_by_user_id,
  first_block_charged,
  rate_credits_locked,
  interval_minutes_locked,
  authorized_blocks,
  blocks_charged,
  paid_through_at,
  last_transfer_id,
  ended_reason,
  created_at
`;

function toIso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapCallRow(row: FoundationCallRow): FoundationInstantCall {
  return {
    id: row.id,
    threadId: row.thread_id,
    callerUserId: row.caller_user_id ?? '',
    calleeUserId: row.callee_user_id ?? '',
    ringStatus: (row.ring_status as FoundationCallRingStatus) ?? 'none',
    streamCallId: row.stream_call_id,
    ringExpiresAtIso: toIso(row.ring_expires_at),
    answeredAtIso: toIso(row.answered_at),
    endedAtIso: toIso(row.ended_at),
    endedByUserId: row.ended_by_user_id,
    firstBlockCharged: Boolean(row.first_block_charged),
    rateCreditsLocked: row.rate_credits_locked === null ? null : Number(row.rate_credits_locked),
    intervalMinutesLocked: row.interval_minutes_locked === null ? null : Number(row.interval_minutes_locked),
    authorizedBlocks: row.authorized_blocks === null ? null : Number(row.authorized_blocks),
    blocksCharged: Number(row.blocks_charged ?? 0),
    paidThroughAtIso: toIso(row.paid_through_at),
    lastTransferId: row.last_transfer_id,
    endedReason: row.ended_reason,
    createdAtIso: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

// The provider's instant-call billing settings, read for the ring pre-check and snapshotted at answer.
type ProviderBillingSettings = { enabled: boolean; rateCredits: number | null; intervalMinutes: number };

async function loadProviderBillingSettings(
  client: PoolClient,
  providerUserId: string,
): Promise<ProviderBillingSettings> {
  const result = await client.query<{
    instant_call_enabled: boolean | null;
    instant_call_rate_credits: number | null;
    instant_call_interval_minutes: number | null;
  }>(
    `
      SELECT instant_call_enabled, instant_call_rate_credits, instant_call_interval_minutes
      FROM foundation_user_extension
      WHERE user_id = $1
      LIMIT 1
    `,
    [providerUserId],
  );
  const row = result.rows[0];
  const rate = row?.instant_call_rate_credits;
  return {
    enabled: Boolean(row?.instant_call_enabled),
    rateCredits: rate === null || rate === undefined ? null : Number(rate),
    intervalMinutes: Number(row?.instant_call_interval_minutes ?? 10),
  };
}

// Normalize the buyer-set block cap: an integer in 1..FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS,
// defaulting to FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS when absent. Anything out of range
// (NaN, <= 0, fractional, or above the hard max) is rejected so a call cannot pre-commit an unbounded or
// nonsensical spend.
function normalizeAuthorizedBlocks(value: number | undefined): number {
  if (value === undefined) {
    return FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS;
  }
  if (!Number.isInteger(value) || value < 1 || value > FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS) {
    throw new Error('invalid_authorized_blocks');
  }
  return value;
}

// Resolve the two participants of the thread the caller belongs to, and the channel id, in one query.
// Throws 'thread_not_found' when the caller is not a participant (mirrors getThreadCredentialsForParticipant).
async function loadThreadForCaller(
  client: PoolClient,
  threadId: string,
  callerUserId: string,
): Promise<{ survivorUserId: string; providerUserId: string; streamChannelId: string }> {
  const result = await client.query<{
    survivor_user_id: string;
    provider_user_id: string;
    stream_channel_id: string;
  }>(
    `
      SELECT t.survivor_user_id, t.provider_user_id, t.stream_channel_id
      FROM foundation_connection_threads t
      JOIN foundation_thread_participants p ON p.thread_id = t.id
      WHERE t.id = $1::uuid
        AND p.user_id = $2
      LIMIT 1
    `,
    [threadId, callerUserId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('thread_not_found');
  }
  return {
    survivorUserId: row.survivor_user_id,
    providerUserId: row.provider_user_id,
    streamChannelId: row.stream_channel_id,
  };
}

// Rate-limit how often one member may place a ring, so a member cannot spam a provider with repeated
// incoming calls (issue #808 v1 safety control). Uses the shared foundation_rate_limit_counters window.
async function assertRingRateLimit(client: PoolClient, callerUserId: string): Promise<void> {
  const now = new Date();
  const windowSeconds = FOUNDATION_INSTANT_CALL_RING_WINDOW_SECONDS;
  const windowStartedAt = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);

  const upserted = await client.query<{ request_count: number }>(
    `
      INSERT INTO foundation_rate_limit_counters
        (user_id, command_name, window_started_at, window_seconds, request_count, updated_at)
      VALUES
        ($1, 'foundation.connection.instant-call.ring', $2, $3, 1, NOW())
      ON CONFLICT (user_id, command_name, window_started_at, window_seconds)
      DO UPDATE SET
        request_count = foundation_rate_limit_counters.request_count + 1,
        updated_at = NOW()
      RETURNING request_count
    `,
    [callerUserId, windowStartedAt, windowSeconds],
  );

  const count = Number(upserted.rows[0]?.request_count ?? 0);
  if (count > FOUNDATION_INSTANT_CALL_RING_LIMIT) {
    throw new Error('rate_limit_exceeded');
  }
}

// Lazily expire any of THIS caller/callee pair's rings that are past their ~60s window. Run inside the
// same transaction as a ring/poll so a never-answered ring does not linger. There is no background job;
// the timeout is realized on the next read or write that touches the row.
async function expireStaleRings(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `
      UPDATE foundation_call_sessions
      SET ring_status = 'timed_out', ended_at = NOW(), updated_at = NOW()
      WHERE ring_status = 'ringing'
        AND ring_expires_at IS NOT NULL
        AND ring_expires_at < NOW()
        AND (caller_user_id = $1 OR callee_user_id = $1)
    `,
    [userId],
  );
}

// Deliver an incoming ring to the callee out-of-band, AFTER the ring row has committed (issue #808 task 5,
// extended for Android native push in issue #884). Deliveries are all best-effort — none may fail the ring:
//   1. A foundation_notification_events row of kind 'instant_call.ring' so the in-app inbox/poll fallback
//      still shows the ring even with no push configured.
//   2. A Web Push to every web device the callee subscribed (sendWebPushToUser no-ops when push is
//      unconfigured or the callee has no devices). The click deep-links to the Foundation incoming-call surface.
//   3. An Expo native push to every Android device the callee subscribed (sendExpoPushToUser no-ops when the
//      callee has no Expo devices; it never throws). Tapping it opens the app at the incoming-call surface.
// Each push runs in its own try/catch so a failure of one delivery never affects the others or the ring.
// The caller's display name is resolved best-effort; it falls back to "Someone" when unresolved.
async function dispatchRingDelivery(call: FoundationInstantCall): Promise<void> {
  let callerName = 'Someone';
  try {
    const names = await resolveUsernames([call.callerUserId]);
    callerName = names.get(call.callerUserId) ?? 'Someone';
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'instant_call_ring_resolve_caller' });
  }

  try {
    await queryDb(
      `
        INSERT INTO foundation_notification_events (user_id, thread_id, kind, title, body, metadata)
        VALUES ($1, $2::uuid, 'instant_call.ring', 'Incoming call', $3, $4::jsonb)
      `,
      [
        call.calleeUserId,
        call.threadId,
        `${callerName} is calling you on Foundation.`,
        JSON.stringify({ type: 'foundation.instant_call.ring', callId: call.id }),
      ],
    );
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'instant_call_ring_notification_event' });
  }

  const ringPayload = {
    title: 'Incoming call',
    body: `${callerName} is calling you on Foundation`,
    data: {
      type: 'foundation.instant_call.ring',
      callId: call.id,
      url: FOUNDATION_INCOMING_CALL_PATH,
    },
  } as const;

  try {
    await sendWebPushToUser(call.calleeUserId, ringPayload);
  } catch (error) {
    // sendWebPushToUser already swallows its own errors; this guard is belt-and-braces so a ring is never
    // affected by push delivery.
    reportError(error, { area: 'foundation', op: 'instant_call_ring_push' });
  }

  try {
    await sendExpoPushToUser(call.calleeUserId, ringPayload);
  } catch (error) {
    // sendExpoPushToUser already swallows its own errors; this guard is belt-and-braces so a ring is never
    // affected by Expo (Android native) push delivery.
    reportError(error, { area: 'foundation', op: 'instant_call_ring_expo_push' });
  }
}

// Resolve and validate the ring target inside the ring transaction: work out who the callee is (the other
// participant of the thread) and run the ring pre-check. Ringing itself moves no credits, but this rejects
// early if the call can't even fund the first block. The provider must have opted in with a valid
// whole-credit rate, and the caller's available balance must cover at least one block at the provider's
// CURRENT rate. (The rate is only LOCKED at answer; this pre-check uses the live rate purely to avoid
// placing a ring that could never be answered without an immediate failure.) Returns the callee's user id.
async function resolveRingTarget(
  client: PoolClient,
  threadId: string,
  callerUserId: string,
): Promise<string> {
  const thread = await loadThreadForCaller(client, threadId, callerUserId);
  // The callee is the other participant. A member can ring the provider; the provider could equally ring
  // the survivor. Whoever is NOT the caller is the callee.
  const calleeUserId =
    thread.survivorUserId === callerUserId ? thread.providerUserId : thread.survivorUserId;
  if (!calleeUserId || calleeUserId === callerUserId) {
    throw new Error('thread_not_found');
  }

  const providerSettings = await loadProviderBillingSettings(client, calleeUserId);
  const rate = providerSettings.rateCredits;
  if (!providerSettings.enabled || rate === null || !Number.isInteger(rate) || rate < 1) {
    throw new Error('billing_misconfigured');
  }
  const wallet = await getOrCreateWallet(callerUserId);
  if (wallet.availableBalance < rate) {
    throw new Error('insufficient_balance');
  }

  return calleeUserId;
}

// Place a ring: the caller (a member who tapped "Connect now") rings the provider on an existing Direct
// Line thread. Audio-only -> modality 'voice'. The callee learns about it two ways: by polling
// getIncomingRing (the in-app fallback) and, when they have enabled call alerts, by a Web Push that wakes
// their device. Returns the created call row in 'ringing' state.
//
// TASK 5 (push notifications): the out-of-band delivery (push + notification-event row) runs in
// dispatchRingDelivery AFTER the transaction commits, so a push failure can never roll back or fail the
// ring. The row shape is unchanged from task 3.
export async function ringInstantCall(input: {
  threadId: string;
  callerUserId: string;
  authorizedBlocks?: number;
}): Promise<FoundationInstantCall> {
  const authorizedBlocks = normalizeAuthorizedBlocks(input.authorizedBlocks);

  const call = await withDbTransaction(async (client) => {
    await expireStaleRings(client, input.callerUserId);
    await assertRingRateLimit(client, input.callerUserId);

    // Resolve the callee and run the ring pre-check (billing enabled + caller can fund the first block).
    const calleeUserId = await resolveRingTarget(client, input.threadId, input.callerUserId);

    const ringExpiresAt = new Date(Date.now() + FOUNDATION_INSTANT_CALL_RING_TIMEOUT_SECONDS * 1000);
    const streamCallId = `foundation-call-${randomUUID()}`;

    try {
      const inserted = await client.query<FoundationCallRow>(
        `
          INSERT INTO foundation_call_sessions
            (thread_id, created_by_user_id, modality, stream_call_id, requested_duration_minutes,
             status, caller_user_id, callee_user_id, ring_status, ring_expires_at, authorized_blocks)
          VALUES
            ($1::uuid, $2, 'voice', $3, 0, 'created', $2, $4, 'ringing', $5, $6)
          RETURNING ${CALL_ROW_COLUMNS}
        `,
        [input.threadId, input.callerUserId, streamCallId, calleeUserId, ringExpiresAt, authorizedBlocks],
      );
      return mapCallRow(inserted.rows[0]);
    } catch (error) {
      // The partial unique index foundation_call_sessions_active_ring_per_callee rejects a second live
      // ring to the same callee. Surface that as a clear, retryable conflict.
      const message = error instanceof Error ? error.message : '';
      if (message.includes('foundation_call_sessions_active_ring_per_callee')) {
        throw new Error('callee_busy');
      }
      throw error;
    }
  });

  // Out-of-band delivery runs after the row has committed so a push or notification-event failure can never
  // fail the ring the caller already placed.
  await dispatchRingDelivery(call);

  return call;
}

// Lazily end any of THIS caller/callee pair's ANSWERED calls whose prepaid window has elapsed (issue #808
// task 4). paid_through_at = answered_at + blocks_charged * interval; once now passes it and the caller has
// not extended, the prepaid time is used up and the call ends with reason 'paid_window_elapsed'. Mirrors
// the lazy ring-timeout sweep: there is no background job, the expiry is realized on the next read/action
// that touches the row. Ending only stops billing -- there is no proration or refund (prepaid blocks, v1).
async function expirePaidWindows(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `
      UPDATE foundation_call_sessions
      SET ring_status = 'ended', status = 'ended', ended_at = NOW(), updated_at = NOW(),
          ended_reason = 'paid_window_elapsed'
      WHERE ring_status = 'answered'
        AND paid_through_at IS NOT NULL
        AND paid_through_at < NOW()
        AND (caller_user_id = $1 OR callee_user_id = $1)
    `,
    [userId],
  );
}

// Load a single call the user participates in (caller or callee), expiring it first if its ring lapsed or
// its prepaid window has elapsed.
async function loadParticipantCall(
  client: PoolClient,
  callId: string,
  userId: string,
): Promise<FoundationCallRow> {
  await expireStaleRings(client, userId);
  await expirePaidWindows(client, userId);
  const result = await client.query<FoundationCallRow>(
    `
      SELECT ${CALL_ROW_COLUMNS}
      FROM foundation_call_sessions
      WHERE id = $1::uuid
        AND (caller_user_id = $2 OR callee_user_id = $2)
      LIMIT 1
    `,
    [callId, userId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('call_not_found');
  }
  return row;
}

// Read the current state of a call for either participant (drives the caller/callee poll). Realizes the
// ring timeout lazily.
export async function getInstantCallState(input: {
  callId: string;
  userId: string;
}): Promise<FoundationInstantCall> {
  return withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.userId);
    return mapCallRow(row);
  });
}

// The callee's incoming-ring inbox: the one live ring (if any) being placed to this user right now. v1
// in-app ring delivery polls this; task 5 (push) will add an out-of-app delivery alongside it.
export async function getIncomingRing(userId: string): Promise<FoundationInstantCall | null> {
  return withDbTransaction(async (client) => {
    await expireStaleRings(client, userId);
    await expirePaidWindows(client, userId);
    const result = await client.query<FoundationCallRow>(
      `
        SELECT ${CALL_ROW_COLUMNS}
        FROM foundation_call_sessions
        WHERE callee_user_id = $1
          AND ring_status = 'ringing'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId],
    );
    const row = result.rows[0];
    return row ? mapCallRow(row) : null;
  });
}

// Charge one block via the canonical peer-to-peer transfer primitive. Caller is always the sender, provider
// always the recipient, amount is always the LOCKED rate. The idempotency key is deterministic per block
// (...-block-N), so a retry of the same block returns the original transfer instead of charging twice.
// createTransfer runs in its OWN db transaction; never call this inside another withDbTransaction.
// Re-throws createTransfer's 'insufficient_balance' to the caller, which handles it by ending the call.
async function chargeBlock(input: {
  callId: string;
  blockNumber: number;
  callerUserId: string;
  providerUserId: string;
  rateCredits: number;
}): Promise<string> {
  const transfer = await createTransfer({
    senderUserId: input.callerUserId,
    recipientUserId: input.providerUserId,
    amount: input.rateCredits,
    idempotencyKey: `foundation-instant-call-${input.callId}-block-${input.blockNumber}`,
    originPlugin: 'foundation',
    reasonCode: 'foundation.instant_call.block_charge',
  });
  return transfer.id;
}

// Mark an answered/ringing call ended with a billing reason, in its own short transaction. Used when a
// charge fails for lack of funds (so the call ends cleanly and no credits moved) or an extend hits the cap.
async function endCallWithReason(callId: string, reason: FoundationCallEndedReason): Promise<FoundationCallRow> {
  return withDbTransaction(async (client) => {
    // Only move a call to 'ended' from a non-terminal state. The per-block charge runs outside a
    // transaction, so a concurrent decline/timeout/normal-end could have already set a terminal
    // ring_status and ended_reason; without this guard that terminal state (and its original reason)
    // would be clobbered. If the row is already terminal, leave it and return it as-is (issue #1971).
    const updated = await client.query<FoundationCallRow>(
      `
        UPDATE foundation_call_sessions
        SET ring_status = 'ended', status = 'ended', ended_at = NOW(), updated_at = NOW(),
            ended_reason = $2
        WHERE id = $1::uuid
          AND ring_status NOT IN ('declined', 'timed_out', 'ended')
        RETURNING ${CALL_ROW_COLUMNS}
      `,
      [callId, reason],
    );
    if (updated.rows[0]) {
      return updated.rows[0];
    }
    const current = await client.query<FoundationCallRow>(
      `SELECT ${CALL_ROW_COLUMNS} FROM foundation_call_sessions WHERE id = $1::uuid`,
      [callId],
    );
    return current.rows[0];
  });
}

// Answer a ringing call AND take the first per-block charge (issue #808 task 4). Only the callee may
// answer, and only while it is still ringing.
//
// Order (correctness): the validation + rate snapshot read run in their own transaction first; then the
// charge runs through createTransfer (its OWN transaction + idempotency, so it is NOT nested); then a
// second transaction records the answer. The deterministic ...-block-1 key makes an answer retry safe.
//   - On 'insufficient_balance': the call is moved to a terminal ended state (reason
//     'caller_insufficient_funds'), no credits move, and 'caller_insufficient_funds' is thrown so the route
//     can surface a clear error. The call is NEVER opened.
//   - On success: the call becomes answered/active with first_block_charged = TRUE, blocks_charged = 1, the
//     rate/interval locked, paid_through_at = answered_at + interval, and last_transfer_id set.
export async function answerInstantCall(input: {
  callId: string;
  calleeUserId: string;
}): Promise<FoundationInstantCall> {
  // 1. Validate + snapshot the provider's current rate/interval. Done in its own transaction so the row is
  //    read consistently; the charge happens AFTER this (createTransfer owns its own transaction).
  const prepared = await withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.calleeUserId);
    if (row.callee_user_id !== input.calleeUserId) {
      throw new Error('not_callee');
    }
    if (row.ring_status !== 'ringing') {
      throw new Error('not_ringing');
    }
    if (!row.caller_user_id) {
      throw new Error('billing_misconfigured');
    }

    const providerSettings = await loadProviderBillingSettings(client, input.calleeUserId);
    const rate = providerSettings.rateCredits;
    if (!providerSettings.enabled || rate === null || !Number.isInteger(rate) || rate < 1) {
      throw new Error('billing_misconfigured');
    }
    return {
      callerUserId: row.caller_user_id,
      rateCredits: rate,
      intervalMinutes: providerSettings.intervalMinutes,
    };
  });

  // 2. Charge the first block (block 1) outside any transaction we own. createTransfer is idempotent on the
  //    deterministic key, so a retried answer does not double-charge.
  let transferId: string;
  try {
    transferId = await chargeBlock({
      callId: input.callId,
      blockNumber: 1,
      callerUserId: prepared.callerUserId,
      providerUserId: input.calleeUserId,
      rateCredits: prepared.rateCredits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'insufficient_balance') {
      await endCallWithReason(input.callId, 'caller_insufficient_funds');
      throw new Error('caller_insufficient_funds');
    }
    throw error;
  }

  // 3. Record the answer: lock the rate/interval, set the first paid window, persist the transfer id. Guard
  //    on ring_status = 'ringing' so a concurrent decline/timeout cannot be overwritten (the charge would
  //    already be idempotent, and the call would simply stay terminal).
  return withDbTransaction(async (client) => {
    const updated = await client.query<FoundationCallRow>(
      `
        UPDATE foundation_call_sessions
        SET ring_status = 'answered', status = 'active', answered_at = NOW(), updated_at = NOW(),
            first_block_charged = TRUE, blocks_charged = 1,
            rate_credits_locked = $2, interval_minutes_locked = $3,
            paid_through_at = NOW() + make_interval(mins => $3::int), last_transfer_id = $4
        WHERE id = $1::uuid AND ring_status = 'ringing'
        RETURNING ${CALL_ROW_COLUMNS}
      `,
      [input.callId, prepared.rateCredits, prepared.intervalMinutes, transferId],
    );
    const row = updated.rows[0];
    if (!row) {
      // The call left 'ringing' between the charge and this write (declined/timed_out/ended). The block-1
      // charge is already idempotent; re-read and return the current terminal row rather than reopening it.
      const current = await loadParticipantCall(client, input.callId, input.calleeUserId);
      return mapCallRow(current);
    }
    return mapCallRow(row);
  });
}

// Charge the next block (issue #808 task 4). Caller-only. Validates the call is active and that the
// buyer-set cap has room (blocks_charged < authorized_blocks); otherwise rejects with 'block_cap_reached'.
// Charges block (blocks_charged + 1) at the LOCKED rate via createTransfer. On 'insufficient_balance' the
// call ends cleanly (reason 'caller_insufficient_funds') and no credits move. On success blocks_charged is
// incremented, paid_through_at is advanced by one interval, and last_transfer_id is set.
export async function extendInstantCall(input: {
  callId: string;
  callerUserId: string;
}): Promise<FoundationInstantCall> {
  // 1. Validate + read the locked rate/interval and current block count in one transaction.
  const prepared = await withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.callerUserId);
    if (row.caller_user_id !== input.callerUserId) {
      throw new Error('not_caller');
    }
    if (row.ring_status !== 'answered') {
      throw new Error('not_active');
    }
    if (!row.callee_user_id || row.rate_credits_locked === null || row.interval_minutes_locked === null) {
      throw new Error('billing_misconfigured');
    }
    const authorizedBlocks = row.authorized_blocks ?? FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS;
    const blocksCharged = Number(row.blocks_charged ?? 0);
    if (blocksCharged >= authorizedBlocks) {
      throw new Error('block_cap_reached');
    }
    return {
      providerUserId: row.callee_user_id,
      rateCredits: Number(row.rate_credits_locked),
      nextBlock: blocksCharged + 1,
    };
  });

  // 2. Charge the next block at the LOCKED rate (idempotent on ...-block-N).
  let transferId: string;
  try {
    transferId = await chargeBlock({
      callId: input.callId,
      blockNumber: prepared.nextBlock,
      callerUserId: input.callerUserId,
      providerUserId: prepared.providerUserId,
      rateCredits: prepared.rateCredits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'insufficient_balance') {
      const ended = await endCallWithReason(input.callId, 'caller_insufficient_funds');
      // End cleanly, then surface the error so the caller UI shows "out of credits".
      void ended;
      throw new Error('caller_insufficient_funds');
    }
    throw error;
  }

  // 3. Record the paid block: advance paid_through_at by exactly one interval from its current value, and
  //    only advance the block matching nextBlock so a duplicate extend can't double-count. Guard on the
  //    call still being answered.
  return withDbTransaction(async (client) => {
    const updated = await client.query<FoundationCallRow>(
      `
        UPDATE foundation_call_sessions
        SET blocks_charged = $2, updated_at = NOW(),
            paid_through_at = paid_through_at + make_interval(mins => interval_minutes_locked::int),
            last_transfer_id = $3
        WHERE id = $1::uuid AND ring_status = 'answered' AND blocks_charged = $4
        RETURNING ${CALL_ROW_COLUMNS}
      `,
      [input.callId, prepared.nextBlock, transferId, prepared.nextBlock - 1],
    );
    const row = updated.rows[0];
    if (!row) {
      // The block was already recorded (a duplicate extend) or the call left 'answered'. The charge is
      // idempotent, so re-read and return the current row rather than advancing the window twice.
      const current = await loadParticipantCall(client, input.callId, input.callerUserId);
      return mapCallRow(current);
    }
    return mapCallRow(row);
  });
}

// Decline a ringing call. Only the callee may decline, and only while ringing. Terminal.
export async function declineInstantCall(input: {
  callId: string;
  calleeUserId: string;
}): Promise<FoundationInstantCall> {
  return withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.calleeUserId);
    if (row.callee_user_id !== input.calleeUserId) {
      throw new Error('not_callee');
    }
    if (row.ring_status !== 'ringing') {
      throw new Error('not_ringing');
    }
    const updated = await client.query<FoundationCallRow>(
      `
        UPDATE foundation_call_sessions
        SET ring_status = 'declined', status = 'canceled', ended_at = NOW(),
            ended_by_user_id = $2, updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING ${CALL_ROW_COLUMNS}
      `,
      [input.callId, input.calleeUserId],
    );
    return mapCallRow(updated.rows[0]);
  });
}

// End a call. Either participant may end it; ends from any non-terminal state (ringing -> caller cancels;
// answered -> either party hangs up). Idempotent: ending an already-ended/declined/timed_out call returns
// the existing terminal row unchanged.
export async function endInstantCall(input: {
  callId: string;
  userId: string;
}): Promise<FoundationInstantCall> {
  return withDbTransaction(async (client) => {
    const row = await loadParticipantCall(client, input.callId, input.userId);
    const terminal: FoundationCallRingStatus[] = ['declined', 'timed_out', 'ended'];
    if (terminal.includes(row.ring_status as FoundationCallRingStatus)) {
      return mapCallRow(row);
    }
    const updated = await client.query<FoundationCallRow>(
      `
        UPDATE foundation_call_sessions
        SET ring_status = 'ended', status = 'ended', ended_at = NOW(),
            ended_by_user_id = $2, updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING ${CALL_ROW_COLUMNS}
      `,
      [input.callId, input.userId],
    );
    return mapCallRow(updated.rows[0]);
  });
}

// Mint the participant-only Stream audio-join credentials for a call. Reuses the SAME token primitive the
// Direct Line uses (createFoundationCallToken -> createFoundationParticipantToken); there is no parallel
// token path. Caller must already be verified as a participant of the call's thread.
export async function getInstantCallJoinCredentials(input: {
  userId: string;
  displayName: string;
}): Promise<{ streamApiKey: string; streamUserId: string; streamToken: string } | null> {
  const credentials = await createFoundationCallToken({
    userId: input.userId,
    displayName: input.displayName,
  });
  if (!credentials) {
    return null;
  }
  return {
    streamApiKey: credentials.streamApiKey,
    streamUserId: credentials.streamUserId,
    streamToken: credentials.streamToken,
  };
}

// Resolve the Direct Line chat channel id for a call's thread (used so the audio room joins a Stream call
// id derived from the existing thread, keeping one thread per pair). Read-only helper for the join route.
export async function getThreadChannelForCall(input: {
  callId: string;
  userId: string;
}): Promise<{ streamChannelId: string }> {
  const result = await queryDb<{ stream_channel_id: string }>(
    `
      SELECT t.stream_channel_id
      FROM foundation_call_sessions c
      JOIN foundation_connection_threads t ON t.id = c.thread_id
      WHERE c.id = $1::uuid
        AND (c.caller_user_id = $2 OR c.callee_user_id = $2)
      LIMIT 1
    `,
    [input.callId, input.userId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('call_not_found');
  }
  return { streamChannelId: row.stream_channel_id };
}
