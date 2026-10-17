// Re-sending ServiceCredits ledger posts that Formance did not take (owner decision, 2026-10-17;
// issue #2907).
//
// Every credit movement is written to the app's own ledger first, which is the record. It is then
// copied to Formance, the outside ledger. When that copy fails, the movement still stands and a
// 'queued' row is left in service_credits_adapter_outbox. Until now nothing read those rows, so after
// the first outage Formance stayed behind for good.
//
// This re-sends each queued row with the same reference it was first sent with, oldest first, and
// marks it delivered. Formance refuses a second transaction with a reference it already holds, and
// that refusal is read as delivered, so a re-send can never be recorded twice. A row that fails again
// stays queued, with the reason and one more attempt counted, for the next run.
//
// account.deletion.reclaim.execute is not re-sent here: a queued row of that command is also the work
// queue for the deletion reclaim sweep (scripts/executeServiceCreditsReclaims.mjs), which runs it.
//
// Only the production schema is replayed, against the production ledger. Demo movements are left alone.
import { queryDb, runWithForcedPool } from 'lib/db/postgres';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
import {
  FORMANCE_DUPLICATE_REFERENCE,
  getFormanceConfigStatus,
  postBurnToFormance,
  postDisputeAdjustmentToFormance,
  postEscrowHoldToFormance,
  postEscrowRefundToFormance,
  postEscrowReleaseToFormance,
  postMintToFormance,
  postTransferToFormance,
  postTreasuryFeeToFormance,
} from './formance-ledger';

type Payload = Record<string, unknown>;
type Replay = (payload: Payload, idempotencyKey: string) => Promise<{ transactionId: string | null }>;

function text(payload: Payload, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`queued payload has no ${key}`);
  return value;
}

function amount(payload: Payload, key = 'amount'): number {
  const value = Number(payload[key]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`queued payload has no positive ${key}`);
  return value;
}

// Each re-send passes exactly what the first send passed, read back from the queued payload.
export const REPLAYS: Record<string, Replay> = {
  'transfer.create': (p, key) =>
    postTransferToFormance({ senderUserId: text(p, 'senderUserId'), recipientUserId: text(p, 'recipientUserId'), amount: amount(p), idempotencyKey: key }),
  'escrow.hold.create': (p, key) =>
    postEscrowHoldToFormance({ transferId: text(p, 'escrowId'), senderUserId: text(p, 'sourceUserId'), recipientUserId: 'pending_destination', amount: amount(p), idempotencyKey: key }),
  'escrow.release': (p, key) =>
    postEscrowReleaseToFormance({ escrowId: text(p, 'escrowId'), sourceUserId: text(p, 'sourceUserId'), destinationUserId: text(p, 'destinationUserId'), amount: amount(p), idempotencyKey: key }),
  'escrow.refund': (p, key) =>
    postEscrowRefundToFormance({ escrowId: text(p, 'escrowId'), sourceUserId: text(p, 'sourceUserId'), amount: amount(p), idempotencyKey: key }),
  'governance.mint.grant': (p, key) =>
    postMintToFormance({ targetUserId: text(p, 'targetUserId'), amount: amount(p), governanceTicketId: text(p, 'governanceTicketId'), idempotencyKey: key }),
  'governance.burn': (p, key) =>
    postBurnToFormance({ targetUserId: text(p, 'targetUserId'), amount: amount(p), governanceTicketId: text(p, 'governanceTicketId'), idempotencyKey: key }),
  'treasury.fee.collect': (p, key) =>
    postTreasuryFeeToFormance({ sourceUserId: text(p, 'sourceUserId'), treasuryUserId: text(p, 'treasuryUserId'), amount: amount(p), originPlugin: text(p, 'originPlugin'), idempotencyKey: key }),
  'dispute.adjustment.apply': (p, key) =>
    postDisputeAdjustmentToFormance({ disputeCaseId: text(p, 'disputeCaseId'), sourceUserId: text(p, 'sourceUserId'), destinationUserId: text(p, 'destinationUserId'), amount: amount(p), idempotencyKey: key }),
};

export const REPLAYABLE_COMMANDS = Object.keys(REPLAYS);

// Rows tried per run, oldest first, so one run stays short. A backlog drains over several runs.
const REPLAY_BATCH_LIMIT = 100;

type QueuedRow = { id: string; command_name: string; idempotency_key: string; payload: Payload };

export type FormanceReplayResult =
  | { skipped: 'not_configured' }
  | { tried: number; delivered: number; alreadyRecorded: number; stillQueued: number; remaining: number };

async function markDelivered(id: string, transactionId: string | null): Promise<void> {
  await queryDb(
    `UPDATE service_credits_adapter_outbox
        SET status = 'delivered', provider_transaction_id = COALESCE($2, provider_transaction_id),
            last_error = NULL, attempt_count = attempt_count + 1, updated_at = NOW()
      WHERE id = $1::uuid AND status = 'queued'`,
    [id, transactionId],
  );
}

async function markStillQueued(id: string, error: unknown): Promise<void> {
  await queryDb(
    `UPDATE service_credits_adapter_outbox
        SET last_error = $2, attempt_count = attempt_count + 1, updated_at = NOW()
      WHERE id = $1::uuid AND status = 'queued'`,
    [id, failureReason(error).slice(0, 500)],
  );
}

// One row: re-send it and record what happened. Returns which count it belongs to.
async function replayRow(row: QueuedRow): Promise<'delivered' | 'alreadyRecorded' | 'stillQueued'> {
  try {
    const posted = await REPLAYS[row.command_name](row.payload ?? {}, row.idempotency_key);
    await markDelivered(row.id, posted.transactionId);
    return 'delivered';
  } catch (error) {
    if (error instanceof Error && error.message === FORMANCE_DUPLICATE_REFERENCE) {
      await markDelivered(row.id, null);
      return 'alreadyRecorded';
    }
    await markStillQueued(row.id, error);
    reportError(error, { area: 'service-credits', op: 'formance_replay', extra: { command: row.command_name } });
    return 'stillQueued';
  }
}

async function replayInActiveSchema(): Promise<FormanceReplayResult> {
  if (!(await getFormanceConfigStatus()).configured) return { skipped: 'not_configured' };
  const due = await queryDb<QueuedRow>(
    `SELECT id::text AS id, command_name, idempotency_key, payload
       FROM service_credits_adapter_outbox
      WHERE status = 'queued' AND command_name = ANY($1::text[])
      ORDER BY updated_at ASC
      LIMIT $2`,
    [REPLAYABLE_COMMANDS, REPLAY_BATCH_LIMIT],
  );
  const counts = { delivered: 0, alreadyRecorded: 0, stillQueued: 0 };
  for (const row of due.rows) {
    counts[await replayRow(row)] += 1;
  }
  const remaining = await countQueuedFormancePosts();
  return { tried: due.rows.length, ...counts, remaining: remaining.queued };
}

export async function replayQueuedFormancePosts(): Promise<FormanceReplayResult> {
  return runWithForcedPool('public', replayInActiveSchema);
}

// How many movements are still waiting to be copied to Formance, and since when. Read by the admin
// ledger status card.
export async function countQueuedFormancePosts(): Promise<{ queued: number; oldestQueuedAtIso: string | null }> {
  const result = await queryDb<{ queued: string; oldest: Date | null }>(
    `SELECT COUNT(*)::text AS queued, MIN(updated_at) AS oldest
       FROM service_credits_adapter_outbox
      WHERE status = 'queued' AND command_name = ANY($1::text[])`,
    [REPLAYABLE_COMMANDS],
  );
  const row = result.rows[0];
  return { queued: Number(row?.queued ?? 0), oldestQueuedAtIso: row?.oldest ? new Date(row.oldest).toISOString() : null };
}
