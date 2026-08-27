import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import { getAccountRestrictionStatus, restrictAccount, unrestrictAccount } from 'lib/auth/account-restrictions';
import {
  postBurnToFormance,
  postDeletionReclaimToFormance,
  postDisputeAdjustmentToFormance,
  postEscrowHoldToFormance,
  postEscrowRefundToFormance,
  postEscrowReleaseToFormance,
  postMintToFormance,
  postTransferToFormance,
  postTreasuryFeeToFormance,
} from 'lib/service-credits/formance-ledger';
import { ensurePositiveAmount } from 'lib/service-credits/amounts';
import { resolveUsernames } from 'lib/identity/resolve-usernames';

type WalletRow = {
  user_id: string;
  available_balance: string;
  escrow_balance: string;
};

function mapWallet(row: WalletRow) {
  return {
    userId: row.user_id,
    availableBalance: Number(row.available_balance),
    escrowBalance: Number(row.escrow_balance),
  };
}

const SERVICE_CREDITS_RECLAIM_WINDOW_DAYS = 7;

// --- Monetary policy helpers (per the ServiceCredits monetary policy spec) ---
// Treasury policy is the single tunable store: the per-period mint budget and the mutual-credit
// limits both live in service_credits_treasury_config.policy so the operator can adjust them
// without a schema change.

type IssuancePolicy = {
  periodDays: number;
  maxMintPerPeriod: number | null;
  maxNetGrowthPctOfCirculation: number | null;
  enforce: boolean;
};

type MutualCreditPolicy = {
  enabled: boolean;
  defaultLimit: number;
  maxLimit: number;
};

function readIssuancePolicy(policy: Record<string, unknown>): IssuancePolicy {
  const raw = (policy.issuance ?? {}) as Record<string, unknown>;
  return {
    periodDays: typeof raw.periodDays === 'number' && raw.periodDays > 0 ? raw.periodDays : 7,
    maxMintPerPeriod:
      typeof raw.maxMintPerPeriod === 'number' && raw.maxMintPerPeriod >= 0 ? raw.maxMintPerPeriod : null,
    maxNetGrowthPctOfCirculation:
      typeof raw.maxNetGrowthPctOfCirculation === 'number' && raw.maxNetGrowthPctOfCirculation >= 0
        ? raw.maxNetGrowthPctOfCirculation
        : null,
    enforce: raw.enforce === true,
  };
}

function readMutualCreditPolicy(policy: Record<string, unknown>): MutualCreditPolicy {
  const raw = (policy.mutualCredit ?? {}) as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    defaultLimit: typeof raw.defaultLimit === 'number' && raw.defaultLimit >= 0 ? raw.defaultLimit : 0,
    maxLimit: typeof raw.maxLimit === 'number' && raw.maxLimit >= 0 ? raw.maxLimit : 0,
  };
}

function readTreasuryUserId(policy: Record<string, unknown>): string | null {
  return typeof policy.treasuryUserId === 'string' && policy.treasuryUserId.length > 0
    ? policy.treasuryUserId
    : null;
}

async function readTreasuryPolicy(client: PoolClient): Promise<Record<string, unknown>> {
  const result = await client.query<{ policy: Record<string, unknown> }>(
    `SELECT policy FROM service_credits_treasury_config WHERE id = TRUE LIMIT 1`,
  );
  return result.rows[0]?.policy ?? {};
}

async function readCreditLimit(client: PoolClient, userId: string, defaultLimit: number): Promise<number> {
  const result = await client.query<{ credit_limit: string }>(
    `SELECT credit_limit::text FROM service_credits_credit_limits WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0] ? Number(result.rows[0].credit_limit) : defaultLimit;
}

async function sumCirculating(client: PoolClient, treasuryUserId: string | null): Promise<number> {
  const result = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(available_balance + escrow_balance), 0)::text AS total
     FROM service_credits_wallets
     WHERE (available_balance + escrow_balance) > 0
       AND ($1::text IS NULL OR user_id <> $1)`,
    [treasuryUserId],
  );
  return Number(result.rows[0]?.total ?? '0');
}

async function sumMintedInPeriod(client: PoolClient, periodDays: number): Promise<number> {
  const result = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM service_credits_governance_events
     WHERE event_type = 'mint_grant' AND created_at > NOW() - make_interval(days => $1::int)`,
    [periodDays],
  );
  return Number(result.rows[0]?.total ?? '0');
}

// The active per-period mint ceiling, or null when minting is not budget-constrained. Enforcement is
// off unless the operator sets issuance.enforce = true. When enforcement is on but no positive budget
// is configured, the ceiling is 0 (an explicit operator choice to freeze treasury minting).
function resolveMintCeiling(policy: IssuancePolicy, circulating: number): number | null {
  if (!policy.enforce) {
    return null;
  }
  const limits: number[] = [];
  if (policy.maxMintPerPeriod !== null) {
    limits.push(policy.maxMintPerPeriod);
  }
  if (policy.maxNetGrowthPctOfCirculation !== null) {
    limits.push((policy.maxNetGrowthPctOfCirculation / 100) * circulating);
  }
  return limits.length === 0 ? 0 : Math.min(...limits);
}

async function readCommandIdempotency<T>(
  client: PoolClient,
  actorId: string,
  commandName: string,
  idempotencyKey: string,
) {
  const result = await client.query<{ response_payload: T }>(
    `SELECT response_payload
     FROM service_credits_command_idempotency
     WHERE actor_id = $1 AND command_name = $2 AND idempotency_key = $3
     LIMIT 1`,
    [actorId, commandName, idempotencyKey],
  );

  return result.rows[0]?.response_payload ?? null;
}

async function writeCommandIdempotency(
  client: PoolClient,
  actorId: string,
  commandName: string,
  idempotencyKey: string,
  responsePayload: Record<string, unknown>,
) {
  await client.query(
    `INSERT INTO service_credits_command_idempotency
      (id, actor_id, command_name, idempotency_key, response_payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (actor_id, command_name, idempotency_key)
     DO UPDATE SET response_payload = EXCLUDED.response_payload, updated_at = NOW()`,
    [randomUUID(), actorId, commandName, idempotencyKey, JSON.stringify(responsePayload)],
  );
}

async function writeAdapterOutbox(
  client: PoolClient,
  input: {
    commandName: string;
    idempotencyKey: string;
    status: 'queued' | 'delivered' | 'failed';
    payload: Record<string, unknown>;
    providerTransactionId?: string | null;
    lastError?: string | null;
  },
) {
  await client.query(
    `INSERT INTO service_credits_adapter_outbox
      (id, command_name, idempotency_key, provider, status, payload, provider_transaction_id, last_error, attempt_count)
     VALUES ($1, $2, $3, 'formance', $4, $5::jsonb, $6, $7, 1)
     ON CONFLICT (command_name, idempotency_key)
     DO UPDATE SET
       status = EXCLUDED.status,
       payload = EXCLUDED.payload,
       provider_transaction_id = EXCLUDED.provider_transaction_id,
       last_error = EXCLUDED.last_error,
       attempt_count = service_credits_adapter_outbox.attempt_count + 1,
       updated_at = NOW()`,
    [
      randomUUID(),
      input.commandName,
      input.idempotencyKey,
      input.status,
      JSON.stringify(input.payload),
      input.providerTransactionId ?? null,
      input.lastError ?? null,
    ],
  );
}

// Returns the caller's wallet, creating it on first access. The `created` flag is true only when this
// call inserted a brand-new wallet row (detected via Postgres `xmax = 0`, which is 0 for a fresh
// insert and non-zero when the ON CONFLICT branch updated an existing row). The wallet route uses the
// flag to emit the contract-required `wallet.create` audit event exactly once, on first provisioning.
export async function getOrCreateWallet(userId: string) {
  const upsert = await queryDb<WalletRow & { was_inserted: boolean }>(
    `INSERT INTO service_credits_wallets (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING user_id, available_balance::text, escrow_balance::text, (xmax = 0) AS was_inserted`,
    [userId],
  );

  const row = upsert.rows[0];
  return { ...mapWallet(row), created: row.was_inserted === true };
}

export type WalletLedgerEntry = {
  id: string;
  entryType: string;
  amount: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

export type WalletLedgerPage = {
  entries: WalletLedgerEntry[];
  // Total rows the member has in the ledger, so the caller can show "Page N of M" rather than
  // guessing whether another page exists.
  total: number;
};

// A member's own wallet history, read straight from the authoritative double-entry record
// (service_credits_ledger_entries). Every mint/transfer/escrow/fee/dispute path writes a row here in
// the same transaction as the balance change, so these entries reconcile to the wallet's available +
// escrow balance. Read-only; scoped to the caller's user_id. This is the FULL ledger — mints,
// transfers in/out, escrow holds/releases, treasury fees, seed allocations — not just governance
// mints (service_credits_governance_events holds only the mint/burn subset, which is why a balance can
// exceed the sum of mint events when transfers or allocations are involved). Returns one page of rows
// plus the member's total row count, so a caller can page through the history a screen at a time.

export async function listWalletLedgerEntries(
  userId: string,
  limit = 50,
  offset = 0,
): Promise<WalletLedgerPage> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const safeOffset = Number.isFinite(offset) ? Math.max(Math.trunc(offset), 0) : 0;
  const result = await queryDb<{
    id: string;
    entry_type: string;
    amount: string;
    reference_type: string;
    reference_id: string;
    created_at: Date;
    total_count: string;
  }>(
    `SELECT id::text, entry_type, amount::text, reference_type, reference_id, created_at,
            COUNT(*) OVER () AS total_count
       FROM service_credits_ledger_entries
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [userId, safeLimit, safeOffset],
  );

  // COUNT(*) OVER () rides along with the page, so the total costs no extra round trip. An empty
  // page carries no window row: either the member has no entries at all, or the caller asked for a
  // page past the end. Fall back to a plain count so a past-the-end request still reports the real
  // total instead of zero.
  const windowTotal = result.rows[0]?.total_count;
  let total = windowTotal === undefined ? 0 : Number(windowTotal);
  if (windowTotal === undefined && safeOffset > 0) {
    const counted = await queryDb<{ total_count: string }>(
      `SELECT COUNT(*)::text AS total_count FROM service_credits_ledger_entries WHERE user_id = $1`,
      [userId],
    );
    total = Number(counted.rows[0]?.total_count ?? 0);
  }

  return {
    total,
    entries: result.rows.map((row) => ({
      id: row.id,
      entryType: row.entry_type,
      amount: Number(row.amount),
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      createdAt: row.created_at.toISOString(),
    })),
  };
}

// A platform restriction at 'all' or 'trading' scope blocks spending on either rail (trust & safety).
async function assertSenderNotRestricted(client: PoolClient, senderUserId: string): Promise<void> {
  const restriction = await client.query<{ is_restricted: boolean; restriction_scope: string }>(
    `SELECT is_restricted, restriction_scope FROM account_restrictions WHERE user_id = $1 LIMIT 1`,
    [senderUserId],
  );
  const restrictionRow = restriction.rows[0];
  if (restrictionRow?.is_restricted && (restrictionRow.restriction_scope === 'all' || restrictionRow.restriction_scope === 'trading')) {
    throw new Error('account_restricted');
  }
}

// On the mutual-credit rail the sender may go negative, but only down to -(credit limit). On the
// balance rail the floor is 0 (the prior behavior). The buyer going negative and the seller going
// positive net to zero, so mutual-credit issuance never inflates total supply.
async function resolveTransferCreditFloor(
  client: PoolClient,
  rail: 'balance' | 'mutual_credit',
  senderUserId: string,
): Promise<number> {
  if (rail !== 'mutual_credit') {
    return 0;
  }
  const mutualCredit = readMutualCreditPolicy(await readTreasuryPolicy(client));
  if (!mutualCredit.enabled) {
    throw new Error('mutual_credit_disabled');
  }
  // Flat, equal line: every member's limit is the same policy defaultLimit unless an admin has set a
  // per-account override. No behavioral score gates spending — there is no credit or social score on
  // this platform; abuse is handled by small caps, the wallet freeze, and disputes, not by ranking.
  return -(await readCreditLimit(client, senderUserId, mutualCredit.defaultLimit));
}

// The idempotency replay for a transfer whose row already exists (ON CONFLICT DO NOTHING returned no
// row): re-read the completed transfer plus any escrow hold and outbox row, and rebuild the original
// response so a retry sees the first call's result rather than re-validating changed wallet state.
async function readExistingTransferResponse(
  client: PoolClient,
  senderUserId: string,
  idempotencyKey: string,
  rail: 'balance' | 'mutual_credit',
) {
  const existingTransfer = await client.query<{
    id: string;
    sender_user_id: string;
    recipient_user_id: string;
    amount: string;
    status: 'pending' | 'completed' | 'canceled' | 'disputed';
  }>(
    `SELECT id::text, sender_user_id, recipient_user_id, amount::text, status
     FROM service_credits_transfers
     WHERE sender_user_id = $1 AND idempotency_key = $2
     LIMIT 1`,
    [senderUserId, idempotencyKey],
  );

  if (!existingTransfer.rows[0]) {
    throw new Error('transfer_conflict');
  }

  const existingEscrow = await client.query<{ id: string }>(
    `SELECT id::text
     FROM service_credits_escrow_holds
     WHERE transfer_id = $1 AND status = 'held'
     ORDER BY created_at DESC
     LIMIT 1`,
    [existingTransfer.rows[0].id],
  );

  const existingOutbox = await client.query<{ provider_transaction_id: string | null }>(
    `SELECT provider_transaction_id
     FROM service_credits_adapter_outbox
     WHERE command_name = 'transfer.create' AND idempotency_key = $1
     LIMIT 1`,
    [idempotencyKey],
  );

  return {
    id: existingTransfer.rows[0].id,
    senderUserId: existingTransfer.rows[0].sender_user_id,
    recipientUserId: existingTransfer.rows[0].recipient_user_id,
    amount: Number(existingTransfer.rows[0].amount),
    status: existingTransfer.rows[0].status,
    escrowHoldId: existingEscrow.rows[0]?.id ?? null,
    externalLedgerTransactionId: existingOutbox.rows[0]?.provider_transaction_id ?? null,
    rail,
  };
}

// Mirror the transfer to the external ledger and record the outcome in the durable outbox. Returns the
// provider transaction id on success, or null when Formance is unavailable (a 'queued' outbox row is
// left for the reconciliation worker; the authoritative local ledger write in the caller is not rolled
// back).
async function postTransferExternal(
  client: PoolClient,
  args: {
    senderUserId: string;
    recipientUserId: string;
    amount: number;
    idempotencyKey: string;
    transferId: string;
    originPlugin: string;
    reasonCode: string;
  },
): Promise<string | null> {
  try {
    const externalLedger = await postTransferToFormance({
      senderUserId: args.senderUserId,
      recipientUserId: args.recipientUserId,
      amount: args.amount,
      idempotencyKey: args.idempotencyKey,
    });
    await writeAdapterOutbox(client, {
      commandName: 'transfer.create',
      idempotencyKey: args.idempotencyKey,
      status: 'delivered',
      payload: {
        transferId: args.transferId,
        senderUserId: args.senderUserId,
        recipientUserId: args.recipientUserId,
        amount: args.amount,
        originPlugin: args.originPlugin,
        reasonCode: args.reasonCode,
      },
      providerTransactionId: externalLedger.transactionId,
    });
    return externalLedger.transactionId;
  } catch (error) {
    await writeAdapterOutbox(client, {
      commandName: 'transfer.create',
      idempotencyKey: args.idempotencyKey,
      status: 'queued',
      payload: {
        transferId: args.transferId,
        senderUserId: args.senderUserId,
        recipientUserId: args.recipientUserId,
        amount: args.amount,
      },
      lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
    });
    // Formance unavailable — the authoritative local ledger write below still completes the transfer,
    // and a durable 'queued' outbox row lets the reconciliation worker mirror it later. Do not roll back.
    return null;
  }
}

export async function createTransfer(input: {
  senderUserId: string;
  recipientUserId: string;
  amount: number;
  idempotencyKey: string;
  originPlugin?: string;
  reasonCode?: string;
  rail?: 'balance' | 'mutual_credit';
}) {
  ensurePositiveAmount(input.amount);

  const rail = input.rail === 'mutual_credit' ? 'mutual_credit' : 'balance';
  const originPlugin = input.originPlugin ?? 'service-credits';
  const reasonCode = input.reasonCode ?? 'transfer';

  return withDbTransaction(async (client) => {
    // Dedup before any freeze/balance/limit check, so a valid retry returns the original transfer (with
    // its original rail) instead of re-validating wallet state that may have changed since the first call.
    const replay = await readCommandIdempotency<{
      id: string;
      senderUserId: string;
      recipientUserId: string;
      amount: number;
      status: 'pending' | 'completed' | 'canceled' | 'disputed';
      escrowHoldId: string | null;
      externalLedgerTransactionId: string | null;
      rail: 'balance' | 'mutual_credit';
    }>(client, input.senderUserId, 'transfer.create', input.idempotencyKey);
    if (replay) {
      return replay;
    }

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1), ($2)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.senderUserId, input.recipientUserId],
    );

    const balanceResult = await client.query<{ available_balance: string }>(
      `SELECT available_balance::text FROM service_credits_wallets WHERE user_id = $1 FOR UPDATE`,
      [input.senderUserId],
    );

    await assertSenderNotRestricted(client, input.senderUserId);

    const senderBalance = Number(balanceResult.rows[0]?.available_balance ?? '0');

    const creditFloor = await resolveTransferCreditFloor(client, rail, input.senderUserId);
    if (senderBalance - input.amount < creditFloor) {
      throw new Error(rail === 'mutual_credit' ? 'credit_limit_exceeded' : 'insufficient_balance');
    }

    const transferId = randomUUID();
    const insertedTransfer = await client.query<{
      id: string;
      sender_user_id: string;
      recipient_user_id: string;
      amount: string;
      status: 'pending' | 'completed' | 'canceled' | 'disputed';
    }>(
      `INSERT INTO service_credits_transfers
        (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, origin_plugin, reason_code, completed_at)
       VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, NOW())
       ON CONFLICT (sender_user_id, idempotency_key) DO NOTHING
       RETURNING id::text, sender_user_id, recipient_user_id, amount::text, status`,
      [
        transferId,
        input.senderUserId,
        input.recipientUserId,
        input.amount,
        input.idempotencyKey,
        originPlugin,
        reasonCode,
      ],
    );

    if (!insertedTransfer.rows[0]) {
      return readExistingTransferResponse(client, input.senderUserId, input.idempotencyKey, rail);
    }

    const externalLedgerTransactionId = await postTransferExternal(client, {
      senderUserId: input.senderUserId,
      recipientUserId: input.recipientUserId,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
      transferId,
      originPlugin,
      reasonCode,
    });

    // Deliver immediately: debit the sender and credit the recipient in one step (no escrow) so the
    // recipient actually receives the credits. Mirrors collectTreasuryFee's wallet -> wallet move; total
    // supply is conserved (sender -amount, recipient +amount). On the mutual-credit rail the sender may go
    // negative down to their limit, which the balance/floor check above already allowed.
    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance - $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.senderUserId, input.amount],
    );

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.recipientUserId, input.amount],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope)
       VALUES
        ($1, $2, 'debit', $4, 'transfer', $3, 'service_credits_non_gdp'),
        ($5, $6, 'credit', $4, 'transfer', $3, 'service_credits_non_gdp')`,
      [randomUUID(), input.senderUserId, transferId, input.amount, randomUUID(), input.recipientUserId],
    );

    const response = {
      id: transferId,
      senderUserId: input.senderUserId,
      recipientUserId: input.recipientUserId,
      amount: input.amount,
      status: 'completed' as const,
      escrowHoldId: null,
      externalLedgerTransactionId,
      rail,
    };

    await writeCommandIdempotency(client, input.senderUserId, 'transfer.create', input.idempotencyKey, response);

    return response;
  });
}

export async function createEscrowHold(input: {
  actorId: string;
  escrowId?: string;
  sourceUserId: string;
  amount: number;
  originPlugin: string;
  releasePolicy: string;
  idempotencyKey: string;
}) {
  ensurePositiveAmount(input.amount);

  return withDbTransaction(async (client) => {
    const existing = await readCommandIdempotency<{
      escrowId: string;
      holdStatus: 'held';
      heldAmount: number;
      externalLedgerTransactionId: string | null;
    }>(client, input.actorId, 'escrow.hold.create', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.sourceUserId],
    );

    const balance = await client.query<{ available_balance: string }>(
      `SELECT available_balance::text
       FROM service_credits_wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [input.sourceUserId],
    );

    if (Number(balance.rows[0]?.available_balance ?? '0') < input.amount) {
      throw new Error('insufficient_balance');
    }

    const escrowId = input.escrowId ?? randomUUID();
    let externalLedgerTransactionId: string | null = null;
    try {
      const externalLedger = await postEscrowHoldToFormance({
        transferId: escrowId,
        senderUserId: input.sourceUserId,
        recipientUserId: 'pending_destination',
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
      });
      externalLedgerTransactionId = externalLedger.transactionId;
      await writeAdapterOutbox(client, {
        commandName: 'escrow.hold.create',
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        payload: {
          escrowId,
          sourceUserId: input.sourceUserId,
          amount: input.amount,
          originPlugin: input.originPlugin,
          releasePolicy: input.releasePolicy,
        },
        providerTransactionId: externalLedgerTransactionId,
      });
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'escrow.hold.create',
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        payload: {
          escrowId,
          sourceUserId: input.sourceUserId,
          amount: input.amount,
        },
        lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
      });
      // Formance unavailable — keep the authoritative local ledger write (committed below) and
      // leave a durable 'queued' outbox row for the reconciliation worker. Do not roll back, so
      // the member's credits are correct locally and the external mirror catches up later.
    }

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance - $2, escrow_balance = escrow_balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.sourceUserId, input.amount],
    );

    await client.query(
      `INSERT INTO service_credits_escrow_holds (id, wallet_user_id, transfer_id, amount, status)
       VALUES ($1, $2, NULL, $3, 'held')`,
      [escrowId, input.sourceUserId, input.amount],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope, metadata)
       VALUES ($1, $2, 'escrow_hold', $4, 'escrow', $3, 'service_credits_non_gdp', $5::jsonb)`,
      [
        randomUUID(),
        input.sourceUserId,
        escrowId,
        input.amount,
        JSON.stringify({ releasePolicy: input.releasePolicy, originPlugin: input.originPlugin, externalLedgerTransactionId }),
      ],
    );

    const response = {
      escrowId,
      holdStatus: 'held' as const,
      heldAmount: input.amount,
      externalLedgerTransactionId,
    };
    await writeCommandIdempotency(client, input.actorId, 'escrow.hold.create', input.idempotencyKey, response);
    return response;
  });
}

export async function releaseEscrow(input: {
  actorId: string;
  escrowId: string;
  destinationUserId: string;
  releaseReason: string;
  originPlugin: string;
  idempotencyKey: string;
}) {
  return withDbTransaction(async (client) => {
    const existing = await readCommandIdempotency<{
      escrowId: string;
      releaseStatus: 'released';
      transferId: string;
      releasedAt: string;
      externalLedgerTransactionId: string | null;
    }>(client, input.actorId, 'escrow.release', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const escrow = await client.query<{ wallet_user_id: string; amount: string; status: 'held' | 'released' | 'reverted' }>(
      `SELECT wallet_user_id, amount::text, status
       FROM service_credits_escrow_holds
       WHERE id = $1
       FOR UPDATE`,
      [input.escrowId],
    );

    if (!escrow.rows[0]) {
      throw new Error('not_found');
    }
    if (escrow.rows[0].status !== 'held') {
      throw new Error('invalid_state');
    }

    const amount = Number(escrow.rows[0].amount);
    const sourceUserId = escrow.rows[0].wallet_user_id;
    const transferId = randomUUID();

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.destinationUserId],
    );

    let externalLedgerTransactionId: string | null = null;
    try {
      const externalLedger = await postEscrowReleaseToFormance({
        escrowId: input.escrowId,
        sourceUserId,
        destinationUserId: input.destinationUserId,
        amount,
        idempotencyKey: input.idempotencyKey,
      });
      externalLedgerTransactionId = externalLedger.transactionId;
      await writeAdapterOutbox(client, {
        commandName: 'escrow.release',
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        payload: {
          escrowId: input.escrowId,
          sourceUserId,
          destinationUserId: input.destinationUserId,
          amount,
          releaseReason: input.releaseReason,
          originPlugin: input.originPlugin,
        },
        providerTransactionId: externalLedgerTransactionId,
      });
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'escrow.release',
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        payload: {
          escrowId: input.escrowId,
          sourceUserId,
          destinationUserId: input.destinationUserId,
          amount,
        },
        lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
      });
      // Formance unavailable — keep the authoritative local ledger write (committed below) and
      // leave a durable 'queued' outbox row for the reconciliation worker. Do not roll back, so
      // the member's credits are correct locally and the external mirror catches up later.
    }

    await client.query(
      `UPDATE service_credits_wallets
       SET escrow_balance = escrow_balance - $2, updated_at = NOW()
       WHERE user_id = $1`,
      [sourceUserId, amount],
    );

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.destinationUserId, amount],
    );

    await client.query(
      `INSERT INTO service_credits_transfers (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
       VALUES ($1, $2, $3, $4, 'completed', $5, NOW())
       ON CONFLICT (sender_user_id, idempotency_key)
       DO NOTHING`,
      [transferId, sourceUserId, input.destinationUserId, amount, input.idempotencyKey],
    );

    await client.query(
      `UPDATE service_credits_escrow_holds
       SET status = 'released', transfer_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [input.escrowId, transferId],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope)
       VALUES
        ($1, $2, 'escrow_release', $4, 'escrow', $3, 'service_credits_non_gdp'),
        ($5, $6, 'credit', $4, 'transfer', $7, 'service_credits_non_gdp')`,
      [randomUUID(), sourceUserId, input.escrowId, amount, randomUUID(), input.destinationUserId, transferId],
    );

    const response = {
      escrowId: input.escrowId,
      releaseStatus: 'released' as const,
      transferId,
      releasedAt: new Date().toISOString(),
      externalLedgerTransactionId,
    };
    await writeCommandIdempotency(client, input.actorId, 'escrow.release', input.idempotencyKey, response);
    return response;
  });
}

export async function refundEscrow(input: {
  actorId: string;
  escrowId: string;
  refundReason: string;
  originPlugin: string;
  idempotencyKey: string;
}) {
  return withDbTransaction(async (client) => {
    const existing = await readCommandIdempotency<{
      escrowId: string;
      refundStatus: 'reverted';
      refundedAt: string;
      externalLedgerTransactionId: string | null;
    }>(client, input.actorId, 'escrow.refund', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const escrow = await client.query<{ wallet_user_id: string; amount: string; status: 'held' | 'released' | 'reverted' }>(
      `SELECT wallet_user_id, amount::text, status
       FROM service_credits_escrow_holds
       WHERE id = $1
       FOR UPDATE`,
      [input.escrowId],
    );

    if (!escrow.rows[0]) {
      throw new Error('not_found');
    }
    if (escrow.rows[0].status !== 'held') {
      throw new Error('invalid_state');
    }

    const amount = Number(escrow.rows[0].amount);
    const sourceUserId = escrow.rows[0].wallet_user_id;

    let externalLedgerTransactionId: string | null = null;
    try {
      const externalLedger = await postEscrowRefundToFormance({
        escrowId: input.escrowId,
        sourceUserId,
        amount,
        idempotencyKey: input.idempotencyKey,
      });
      externalLedgerTransactionId = externalLedger.transactionId;
      await writeAdapterOutbox(client, {
        commandName: 'escrow.refund',
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        payload: {
          escrowId: input.escrowId,
          sourceUserId,
          amount,
          refundReason: input.refundReason,
          originPlugin: input.originPlugin,
        },
        providerTransactionId: externalLedgerTransactionId,
      });
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'escrow.refund',
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        payload: {
          escrowId: input.escrowId,
          sourceUserId,
          amount,
        },
        lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
      });
      // Formance unavailable — keep the authoritative local ledger write (committed below) and
      // leave a durable 'queued' outbox row for the reconciliation worker. Do not roll back, so
      // the member's credits are correct locally and the external mirror catches up later.
    }

    await client.query(
      `UPDATE service_credits_wallets
       SET escrow_balance = escrow_balance - $2, available_balance = available_balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [sourceUserId, amount],
    );

    await client.query(
      `UPDATE service_credits_escrow_holds
       SET status = 'reverted', updated_at = NOW()
       WHERE id = $1`,
      [input.escrowId],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope)
       VALUES ($1, $2, 'escrow_refund', $4, 'escrow', $3, 'service_credits_non_gdp')`,
      [randomUUID(), sourceUserId, input.escrowId, amount],
    );

    const response = {
      escrowId: input.escrowId,
      refundStatus: 'reverted' as const,
      refundedAt: new Date().toISOString(),
      externalLedgerTransactionId,
    };
    await writeCommandIdempotency(client, input.actorId, 'escrow.refund', input.idempotencyKey, response);
    return response;
  });
}

export async function mintGrant(input: {
  actorId: string;
  targetUserId: string;
  amount: number;
  grantReason: string;
  governanceTicketId: string;
  idempotencyKey: string;
}) {
  ensurePositiveAmount(input.amount);

  return withDbTransaction(async (client) => {
    const existing = await readCommandIdempotency<{
      governanceEventId: string;
      mintStatus: 'completed';
      mintedAt: string;
      externalLedgerTransactionId: string | null;
    }>(client, input.actorId, 'governance.mint.grant', input.idempotencyKey);
    if (existing) {
      // Idempotency replay: this exact mint already committed in a prior call. Flag it so callers can
      // tell a fresh grant from a replay and avoid double-counting / duplicate follow-up audits.
      return { ...existing, replayed: true as const };
    }

    // Per-period mint budget (the keystone rule). Off unless the operator turns it on; mutual-credit
    // issuance is bounded separately and does not draw on this budget.
    const treasuryPolicy = await readTreasuryPolicy(client);
    const issuance = readIssuancePolicy(treasuryPolicy);
    if (issuance.enforce) {
      // Serialize concurrent budget checks so two mints can't both pass the ceiling and commit above it.
      // Transaction-scoped, so it releases on commit/rollback; mints are rare so contention is negligible.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('service_credits.mint_budget'))`);
      const circulating = await sumCirculating(client, readTreasuryUserId(treasuryPolicy));
      const ceiling = resolveMintCeiling(issuance, circulating);
      if (ceiling !== null) {
        const mintedThisPeriod = await sumMintedInPeriod(client, issuance.periodDays);
        if (mintedThisPeriod + input.amount > ceiling) {
          throw new Error('mint_budget_exceeded');
        }
      }
    }

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.targetUserId],
    );

    let externalLedgerTransactionId: string | null = null;
    try {
      const externalLedger = await postMintToFormance({
        targetUserId: input.targetUserId,
        amount: input.amount,
        governanceTicketId: input.governanceTicketId,
        idempotencyKey: input.idempotencyKey,
      });
      externalLedgerTransactionId = externalLedger.transactionId;
      await writeAdapterOutbox(client, {
        commandName: 'governance.mint.grant',
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        payload: {
          targetUserId: input.targetUserId,
          amount: input.amount,
          governanceTicketId: input.governanceTicketId,
          grantReason: input.grantReason,
        },
        providerTransactionId: externalLedgerTransactionId,
      });
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'governance.mint.grant',
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        payload: {
          targetUserId: input.targetUserId,
          amount: input.amount,
          governanceTicketId: input.governanceTicketId,
        },
        lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
      });
      // Formance unavailable — keep the authoritative local ledger write (committed below) and
      // leave a durable 'queued' outbox row for the reconciliation worker. Do not roll back, so
      // the member's credits are correct locally and the external mirror catches up later.
    }

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.targetUserId, input.amount],
    );

    const governanceEventId = randomUUID();
    await client.query(
      `INSERT INTO service_credits_governance_events
        (id, event_type, target_user_id, amount, governance_ticket_id, reason, actor_id, idempotency_key, provider_transaction_id)
       VALUES ($1, 'mint_grant', $2, $3, $4, $5, $6, $7, $8)`,
      [governanceEventId, input.targetUserId, input.amount, input.governanceTicketId, input.grantReason, input.actorId, input.idempotencyKey, externalLedgerTransactionId],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope)
       VALUES ($1, $2, 'credit', $4, 'governance', $3, 'service_credits_non_gdp')`,
      [randomUUID(), input.targetUserId, governanceEventId, input.amount],
    );

    const response = {
      governanceEventId,
      mintStatus: 'completed' as const,
      mintedAt: new Date().toISOString(),
      externalLedgerTransactionId,
    };
    await writeCommandIdempotency(client, input.actorId, 'governance.mint.grant', input.idempotencyKey, response);
    // replayed:false marks this as the first/fresh commit of this idempotency key (vs. the replay path above).
    return { ...response, replayed: false as const };
  });
}

export async function burnCredits(input: {
  actorId: string;
  targetUserId: string;
  amount: number;
  burnReason: string;
  governanceTicketId: string;
  idempotencyKey: string;
}) {
  ensurePositiveAmount(input.amount);

  return withDbTransaction(async (client) => {
    const existing = await readCommandIdempotency<{
      governanceEventId: string;
      burnStatus: 'completed';
      burnedAt: string;
      externalLedgerTransactionId: string | null;
    }>(client, input.actorId, 'governance.burn', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.targetUserId],
    );

    const wallet = await client.query<{ available_balance: string }>(
      `SELECT available_balance::text
       FROM service_credits_wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [input.targetUserId],
    );

    if (Number(wallet.rows[0]?.available_balance ?? '0') < input.amount) {
      throw new Error('insufficient_balance');
    }

    let externalLedgerTransactionId: string | null = null;
    try {
      const externalLedger = await postBurnToFormance({
        targetUserId: input.targetUserId,
        amount: input.amount,
        governanceTicketId: input.governanceTicketId,
        idempotencyKey: input.idempotencyKey,
      });
      externalLedgerTransactionId = externalLedger.transactionId;
      await writeAdapterOutbox(client, {
        commandName: 'governance.burn',
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        payload: {
          targetUserId: input.targetUserId,
          amount: input.amount,
          governanceTicketId: input.governanceTicketId,
          burnReason: input.burnReason,
        },
        providerTransactionId: externalLedgerTransactionId,
      });
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'governance.burn',
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        payload: {
          targetUserId: input.targetUserId,
          amount: input.amount,
          governanceTicketId: input.governanceTicketId,
        },
        lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
      });
      // Formance unavailable — keep the authoritative local ledger write (committed below) and
      // leave a durable 'queued' outbox row for the reconciliation worker. Do not roll back, so
      // the member's credits are correct locally and the external mirror catches up later.
    }

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance - $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.targetUserId, input.amount],
    );

    const governanceEventId = randomUUID();
    await client.query(
      `INSERT INTO service_credits_governance_events
        (id, event_type, target_user_id, amount, governance_ticket_id, reason, actor_id, idempotency_key, provider_transaction_id)
       VALUES ($1, 'burn', $2, $3, $4, $5, $6, $7, $8)`,
      [governanceEventId, input.targetUserId, input.amount, input.governanceTicketId, input.burnReason, input.actorId, input.idempotencyKey, externalLedgerTransactionId],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope)
       VALUES ($1, $2, 'debit', $4, 'governance', $3, 'service_credits_non_gdp')`,
      [randomUUID(), input.targetUserId, governanceEventId, input.amount],
    );

    const response = {
      governanceEventId,
      burnStatus: 'completed' as const,
      burnedAt: new Date().toISOString(),
      externalLedgerTransactionId,
    };
    await writeCommandIdempotency(client, input.actorId, 'governance.burn', input.idempotencyKey, response);
    return response;
  });
}

export async function collectTreasuryFee(input: {
  actorId: string;
  sourceUserId: string;
  treasuryUserId: string;
  amount: number;
  feeReasonCode: string;
  originPlugin: string;
  idempotencyKey: string;
}) {
  ensurePositiveAmount(input.amount);

  return withDbTransaction(async (client) => {
    const existing = await readCommandIdempotency<{
      treasuryEventId: string;
      transferId: string;
      collectionStatus: 'completed';
      collectedAt: string;
      externalLedgerTransactionId: string | null;
    }>(client, input.actorId, 'treasury.fee.collect', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1), ($2)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.sourceUserId, input.treasuryUserId],
    );

    const sourceWallet = await client.query<{ available_balance: string }>(
      `SELECT available_balance::text
       FROM service_credits_wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [input.sourceUserId],
    );

    if (Number(sourceWallet.rows[0]?.available_balance ?? '0') < input.amount) {
      throw new Error('insufficient_balance');
    }

    let externalLedgerTransactionId: string | null = null;
    try {
      const externalLedger = await postTreasuryFeeToFormance({
        sourceUserId: input.sourceUserId,
        treasuryUserId: input.treasuryUserId,
        amount: input.amount,
        originPlugin: input.originPlugin,
        idempotencyKey: input.idempotencyKey,
      });
      externalLedgerTransactionId = externalLedger.transactionId;
      await writeAdapterOutbox(client, {
        commandName: 'treasury.fee.collect',
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        payload: {
          sourceUserId: input.sourceUserId,
          treasuryUserId: input.treasuryUserId,
          amount: input.amount,
          feeReasonCode: input.feeReasonCode,
          originPlugin: input.originPlugin,
        },
        providerTransactionId: externalLedgerTransactionId,
      });
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'treasury.fee.collect',
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        payload: {
          sourceUserId: input.sourceUserId,
          treasuryUserId: input.treasuryUserId,
          amount: input.amount,
          originPlugin: input.originPlugin,
        },
        lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
      });
      // Formance unavailable — keep the authoritative local ledger write (committed below) and
      // leave a durable 'queued' outbox row for the reconciliation worker. Do not roll back, so
      // the member's credits are correct locally and the external mirror catches up later.
    }

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance - $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.sourceUserId, input.amount],
    );

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.treasuryUserId, input.amount],
    );

    const transferId = randomUUID();
    await client.query(
      `INSERT INTO service_credits_transfers (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
       VALUES ($1, $2, $3, $4, 'completed', $5, NOW())
       ON CONFLICT (sender_user_id, idempotency_key)
       DO NOTHING`,
      [transferId, input.sourceUserId, input.treasuryUserId, input.amount, input.idempotencyKey],
    );

    const treasuryEventId = randomUUID();
    await client.query(
      `INSERT INTO service_credits_treasury_events
        (id, event_type, source_user_id, treasury_user_id, amount, transfer_id, reason_code, actor_id, idempotency_key, provider_transaction_id)
       VALUES ($1, 'fee_collect', $2, $3, $4, $5, $6, $7, $8, $9)`,
      [treasuryEventId, input.sourceUserId, input.treasuryUserId, input.amount, transferId, input.feeReasonCode, input.actorId, input.idempotencyKey, externalLedgerTransactionId],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope)
       VALUES
        ($1, $2, 'debit', $4, 'treasury_fee', $3, 'service_credits_non_gdp'),
        ($5, $6, 'credit', $4, 'treasury_fee', $3, 'service_credits_non_gdp')`,
      [randomUUID(), input.sourceUserId, treasuryEventId, input.amount, randomUUID(), input.treasuryUserId],
    );

    const response = {
      treasuryEventId,
      transferId,
      collectionStatus: 'completed' as const,
      collectedAt: new Date().toISOString(),
      externalLedgerTransactionId,
    };
    await writeCommandIdempotency(client, input.actorId, 'treasury.fee.collect', input.idempotencyKey, response);
    return response;
  });
}

export async function applyDisputeAdjustment(input: {
  actorId: string;
  disputeCaseId: string;
  sourceUserId: string;
  destinationUserId: string;
  amount: number;
  adjustmentReason: string;
  idempotencyKey: string;
}) {
  ensurePositiveAmount(input.amount);

  return withDbTransaction(async (client) => {
    const existing = await readCommandIdempotency<{
      adjustmentId: string;
      transferId: string;
      adjustmentStatus: 'completed';
      appliedAt: string;
      externalLedgerTransactionId: string | null;
    }>(client, input.actorId, 'dispute.adjustment.apply', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1), ($2)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.sourceUserId, input.destinationUserId],
    );

    const sourceWallet = await client.query<{ available_balance: string }>(
      `SELECT available_balance::text
       FROM service_credits_wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [input.sourceUserId],
    );

    if (Number(sourceWallet.rows[0]?.available_balance ?? '0') < input.amount) {
      throw new Error('insufficient_balance');
    }

    let externalLedgerTransactionId: string | null = null;
    try {
      const externalLedger = await postDisputeAdjustmentToFormance({
        sourceUserId: input.sourceUserId,
        destinationUserId: input.destinationUserId,
        amount: input.amount,
        disputeCaseId: input.disputeCaseId,
        idempotencyKey: input.idempotencyKey,
      });
      externalLedgerTransactionId = externalLedger.transactionId;
      await writeAdapterOutbox(client, {
        commandName: 'dispute.adjustment.apply',
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        payload: {
          disputeCaseId: input.disputeCaseId,
          sourceUserId: input.sourceUserId,
          destinationUserId: input.destinationUserId,
          amount: input.amount,
          adjustmentReason: input.adjustmentReason,
        },
        providerTransactionId: externalLedgerTransactionId,
      });
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'dispute.adjustment.apply',
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        payload: {
          disputeCaseId: input.disputeCaseId,
          sourceUserId: input.sourceUserId,
          destinationUserId: input.destinationUserId,
          amount: input.amount,
        },
        lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
      });
      // Formance unavailable — keep the authoritative local ledger write (committed below) and
      // leave a durable 'queued' outbox row for the reconciliation worker. Do not roll back, so
      // the member's credits are correct locally and the external mirror catches up later.
    }

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance - $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.sourceUserId, input.amount],
    );

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [input.destinationUserId, input.amount],
    );

    const transferId = randomUUID();
    await client.query(
      `INSERT INTO service_credits_transfers (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
       VALUES ($1, $2, $3, $4, 'completed', $5, NOW())
       ON CONFLICT (sender_user_id, idempotency_key)
       DO NOTHING`,
      [transferId, input.sourceUserId, input.destinationUserId, input.amount, input.idempotencyKey],
    );

    const adjustmentId = randomUUID();
    await client.query(
      `INSERT INTO service_credits_dispute_adjustments
        (id, dispute_case_id, source_user_id, destination_user_id, amount, adjustment_reason, transfer_id, actor_id, idempotency_key, provider_transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [adjustmentId, input.disputeCaseId, input.sourceUserId, input.destinationUserId, input.amount, input.adjustmentReason, transferId, input.actorId, input.idempotencyKey, externalLedgerTransactionId],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope)
       VALUES
        ($1, $2, 'debit', $4, 'dispute_adjustment', $3, 'service_credits_non_gdp'),
        ($5, $6, 'credit', $4, 'dispute_adjustment', $3, 'service_credits_non_gdp')`,
      [randomUUID(), input.sourceUserId, adjustmentId, input.amount, randomUUID(), input.destinationUserId],
    );

    const response = {
      adjustmentId,
      transferId,
      adjustmentStatus: 'completed' as const,
      appliedAt: new Date().toISOString(),
      externalLedgerTransactionId,
    };
    await writeCommandIdempotency(client, input.actorId, 'dispute.adjustment.apply', input.idempotencyKey, response);
    return response;
  });
}

// Validate the deletion request timestamp and enforce the reclaim cooling-off window. Throws
// 'invalid_payload' for an unparseable timestamp and 'reclaim_window_not_elapsed' before the window
// closes.
function assertReclaimEligible(requestedAt: string): void {
  const requestedAtDate = new Date(requestedAt);
  if (Number.isNaN(requestedAtDate.getTime())) {
    throw new Error('invalid_payload');
  }

  const eligibleAt = new Date(requestedAtDate.getTime() + SERVICE_CREDITS_RECLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (Date.now() < eligibleAt.getTime()) {
    throw new Error('reclaim_window_not_elapsed');
  }
}

// A held escrow blocks reclaim: the credits are committed elsewhere and must resolve first. Throws
// 'active_escrow_holds' when the account still has any held escrow.
async function assertNoActiveEscrowHolds(client: PoolClient, accountId: string): Promise<void> {
  const activeEscrows = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM service_credits_escrow_holds
     WHERE wallet_user_id = $1 AND status = 'held'`,
    [accountId],
  );

  if (Number(activeEscrows.rows[0]?.total ?? '0') > 0) {
    throw new Error('active_escrow_holds');
  }
}

// Read the account's balances under a row lock and derive the reclaim figures: the amount transferred
// to the treasury (any positive available balance) and the mutual-credit default the treasury absorbs
// (any negative available balance).
async function readReclaimWalletBalances(client: PoolClient, accountId: string) {
  const wallet = await client.query<{ available_balance: string; escrow_balance: string }>(
    `SELECT available_balance::text, escrow_balance::text
     FROM service_credits_wallets
     WHERE user_id = $1
     FOR UPDATE`,
    [accountId],
  );

  const availableBalance = Number(wallet.rows[0]?.available_balance ?? '0');
  const escrowBalance = Number(wallet.rows[0]?.escrow_balance ?? '0');
  const amountTransferred = Math.max(0, availableBalance);
  // A negative balance at deletion is a mutual-credit default: the treasury (the community) absorbs
  // the shortfall. Bounded by small per-account credit limits so a single default stays minor.
  const mutualCreditDefault = availableBalance < 0 ? -availableBalance : 0;

  return { availableBalance, escrowBalance, amountTransferred, mutualCreditDefault };
}

// The authoritative local writes for a reclaim. No external call has been made yet, so if any of these
// mutations throws, the whole transaction rolls back with no orphaned external-ledger posting. The
// Formance call and outbox write are deferred until after every local mutation (see postReclaimExternal).
async function applyReclaimLocalWrites(
  client: PoolClient,
  args: {
    accountId: string;
    treasuryUserId: string;
    deletionRequestId: string;
    idempotencyKey: string;
    availableBalance: number;
    escrowBalance: number;
    amountTransferred: number;
    mutualCreditDefault: number;
  },
): Promise<{ transferId: string | null; tombstoneId: string }> {
  if (args.amountTransferred > 0) {
    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance - $2, updated_at = NOW()
       WHERE user_id = $1`,
      [args.accountId, args.amountTransferred],
    );

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance + $2, updated_at = NOW()
       WHERE user_id = $1`,
      [args.treasuryUserId, args.amountTransferred],
    );
  }

  if (args.mutualCreditDefault > 0) {
    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = available_balance - $2, updated_at = NOW()
       WHERE user_id = $1`,
      [args.treasuryUserId, args.mutualCreditDefault],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope, metadata)
       VALUES ($1, $2, 'debit', $3, 'mutual_credit_default', $4, 'service_credits_non_gdp', $5::jsonb)`,
      [
        randomUUID(),
        args.treasuryUserId,
        args.mutualCreditDefault,
        args.accountId,
        JSON.stringify({ defaultedBy: args.accountId, deletionRequestId: args.deletionRequestId }),
      ],
    );
  }

  const transferId = args.amountTransferred > 0 ? randomUUID() : null;
  if (transferId) {
    await client.query(
      `INSERT INTO service_credits_transfers (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
       VALUES ($1, $2, $3, $4, 'completed', $5, NOW())
       ON CONFLICT (sender_user_id, idempotency_key)
       DO NOTHING`,
      [transferId, args.accountId, args.treasuryUserId, args.amountTransferred, args.idempotencyKey],
    );
  }

  const tombstoneId = randomUUID();
  await client.query(
    `INSERT INTO service_credits_wallet_tombstones
      (id, account_id, deletion_request_id, final_available_balance, final_escrow_balance)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (account_id, deletion_request_id)
     DO UPDATE SET final_available_balance = EXCLUDED.final_available_balance, final_escrow_balance = EXCLUDED.final_escrow_balance`,
    [tombstoneId, args.accountId, args.deletionRequestId, args.availableBalance, args.escrowBalance],
  );

  await client.query(
    `UPDATE service_credits_wallets
     SET available_balance = 0, escrow_balance = 0, updated_at = NOW()
     WHERE user_id = $1`,
    [args.accountId],
  );

  return { transferId, tombstoneId };
}

// External ledger + durable outbox for a reclaim, AFTER every local mutation. Returns the provider
// transaction id on success, or null when Formance is unavailable or when there is nothing to mirror.
async function postReclaimExternal(
  client: PoolClient,
  args: {
    accountId: string;
    treasuryUserId: string;
    deletionRequestId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    amountTransferred: number;
    mutualCreditDefault: number;
  },
): Promise<string | null> {
  if (args.amountTransferred > 0) {
    try {
      const externalLedger = await postDeletionReclaimToFormance({
        accountId: args.accountId,
        treasuryUserId: args.treasuryUserId,
        amount: args.amountTransferred,
        deletionRequestId: args.deletionRequestId,
        idempotencyKey: args.idempotencyKey,
      });
      await writeAdapterOutbox(client, {
        commandName: 'account.deletion.reclaim.execute',
        idempotencyKey: args.idempotencyKey,
        status: 'delivered',
        payload: {
          accountId: args.accountId,
          treasuryUserId: args.treasuryUserId,
          amountTransferred: args.amountTransferred,
          deletionRequestId: args.deletionRequestId,
          requestId: args.requestId,
          traceId: args.traceId,
        },
        providerTransactionId: externalLedger.transactionId,
      });
      return externalLedger.transactionId;
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'account.deletion.reclaim.execute',
        idempotencyKey: args.idempotencyKey,
        status: 'queued',
        payload: {
          accountId: args.accountId,
          treasuryUserId: args.treasuryUserId,
          amountTransferred: args.amountTransferred,
          deletionRequestId: args.deletionRequestId,
        },
        lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
      });
      // Formance unavailable — keep the authoritative local ledger write and leave a durable
      // 'queued' outbox row for the reconciliation worker. Do not roll back.
      return null;
    }
  }

  if (args.mutualCreditDefault > 0) {
    // A mutual-credit default posts no local transfer, so the happy-path outbox write above is
    // skipped — but the reconciliation worker still needs a record so it can emit the
    // mutual_credit_default event to the external ledger. Without this row the external ledger
    // diverges silently for every mutual-credit-default account. Leave a durable 'queued' row.
    await writeAdapterOutbox(client, {
      commandName: 'account.deletion.reclaim.execute',
      idempotencyKey: args.idempotencyKey,
      status: 'queued',
      payload: {
        accountId: args.accountId,
        treasuryUserId: args.treasuryUserId,
        amountTransferred: args.amountTransferred,
        mutualCreditDefault: args.mutualCreditDefault,
        deletionRequestId: args.deletionRequestId,
        requestId: args.requestId,
        traceId: args.traceId,
      },
    });
  }

  return null;
}

// Record the reclaim outcome: the reclaim ledger row and the treasury event, both idempotent on retry.
async function recordReclaimResult(
  client: PoolClient,
  args: {
    accountId: string;
    treasuryUserId: string;
    deletionRequestId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    actorId: string;
    amountTransferred: number;
    transferId: string | null;
    tombstoneId: string;
    externalLedgerTransactionId: string | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO service_credits_account_deletion_reclaims
      (id, account_id, deletion_request_id, treasury_user_id, amount_transferred, transfer_id, tombstone_id, request_id, trace_id, actor_id, idempotency_key, provider_transaction_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (account_id, deletion_request_id)
     DO UPDATE SET amount_transferred = EXCLUDED.amount_transferred, transfer_id = EXCLUDED.transfer_id, tombstone_id = EXCLUDED.tombstone_id, provider_transaction_id = EXCLUDED.provider_transaction_id`,
    [
      randomUUID(),
      args.accountId,
      args.deletionRequestId,
      args.treasuryUserId,
      args.amountTransferred,
      args.transferId,
      args.tombstoneId,
      args.requestId,
      args.traceId,
      args.actorId,
      args.idempotencyKey,
      args.externalLedgerTransactionId,
    ],
  );

  await client.query(
    `INSERT INTO service_credits_treasury_events
      (id, event_type, source_user_id, treasury_user_id, amount, transfer_id, reason_code, actor_id, idempotency_key, provider_transaction_id)
     VALUES ($1, 'deletion_reclaim', $2, $3, $4, $5, 'account_deleted_and_returned_to_treasury', $6, $7, $8)
     ON CONFLICT (event_type, actor_id, idempotency_key)
     DO NOTHING`,
    [randomUUID(), args.accountId, args.treasuryUserId, args.amountTransferred, args.transferId, args.actorId, args.idempotencyKey, args.externalLedgerTransactionId],
  );
}

export async function executeDeletionReclaim(input: {
  actorId: string;
  accountId: string;
  deletionRequestId: string;
  treasuryUserId: string;
  requestedAt: string;
  idempotencyKey: string;
  requestId: string;
  traceId: string;
}) {
  return withDbTransaction(async (client) => {
    const existing = await readCommandIdempotency<{
      reclaimStatus: 'completed';
      amountTransferred: number;
      transferId: string | null;
      tombstoneId: string;
      processedAt: string;
      externalLedgerTransactionId: string | null;
    }>(client, input.actorId, 'account.deletion.reclaim.execute', input.idempotencyKey);
    if (existing) {
      return existing;
    }

    assertReclaimEligible(input.requestedAt);

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1), ($2)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.accountId, input.treasuryUserId],
    );

    await assertNoActiveEscrowHolds(client, input.accountId);

    const { availableBalance, escrowBalance, amountTransferred, mutualCreditDefault } =
      await readReclaimWalletBalances(client, input.accountId);

    const { transferId, tombstoneId } = await applyReclaimLocalWrites(client, {
      accountId: input.accountId,
      treasuryUserId: input.treasuryUserId,
      deletionRequestId: input.deletionRequestId,
      idempotencyKey: input.idempotencyKey,
      availableBalance,
      escrowBalance,
      amountTransferred,
      mutualCreditDefault,
    });

    const externalLedgerTransactionId = await postReclaimExternal(client, {
      accountId: input.accountId,
      treasuryUserId: input.treasuryUserId,
      deletionRequestId: input.deletionRequestId,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      traceId: input.traceId,
      amountTransferred,
      mutualCreditDefault,
    });

    await recordReclaimResult(client, {
      accountId: input.accountId,
      treasuryUserId: input.treasuryUserId,
      deletionRequestId: input.deletionRequestId,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      traceId: input.traceId,
      actorId: input.actorId,
      amountTransferred,
      transferId,
      tombstoneId,
      externalLedgerTransactionId,
    });

    const response = {
      reclaimStatus: 'completed' as const,
      amountTransferred,
      transferId,
      tombstoneId,
      processedAt: new Date().toISOString(),
      externalLedgerTransactionId,
    };
    await writeCommandIdempotency(client, input.actorId, 'account.deletion.reclaim.execute', input.idempotencyKey, response);
    return response;
  });
}

// Look up the sender/recipient of a transfer so a dispute-create route can confirm the caller was a
// party to it. Returns null when the transfer does not exist. Read-only; no balance change.
export async function getTransferParties(
  transferId: string,
): Promise<{ senderUserId: string; recipientUserId: string } | null> {
  const result = await queryDb<{ sender_user_id: string; recipient_user_id: string }>(
    `SELECT sender_user_id, recipient_user_id
       FROM service_credits_transfers
      WHERE id = $1
      LIMIT 1`,
    [transferId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return { senderUserId: row.sender_user_id, recipientUserId: row.recipient_user_id };
}

export async function createDispute(input: { transferId: string; openedByUserId: string; reason: string }) {
  const inserted = await queryDb<{ id: string }>(
    `INSERT INTO service_credits_disputes (id, transfer_id, opened_by_user_id, reason)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text`,
    [randomUUID(), input.transferId, input.openedByUserId, input.reason.trim()],
  );

  return inserted.rows[0].id;
}

// One open dispute in the admin review list. `openedByName` is the resolved display name (null when
// it can't be resolved). There is no status column on service_credits_disputes; "open" means no
// dispute adjustment has been applied yet (no matching service_credits_dispute_adjustments row).
export type ServiceCreditsAdminDispute = {
  id: string;
  transferId: string;
  openedByUserId: string;
  openedByName: string | null;
  reason: string;
  createdAtIso: string;
};

type OpenDisputeRow = {
  id: string;
  transfer_id: string;
  opened_by_user_id: string;
  reason: string;
  created_at: Date;
};

// Admin-only: open disputes (no adjustment applied yet), newest first, capped. Resolves opener display
// names in one batched Clerk lookup. Backs the admin disputes review list and the admin-landing dot.
export async function listOpenDisputes(limit = 100): Promise<ServiceCreditsAdminDispute[]> {
  const pageSize = Math.min(Math.max(1, limit), 200);
  const result = await queryDb<OpenDisputeRow>(
    `SELECT d.id::text, d.transfer_id::text, d.opened_by_user_id, d.reason, d.created_at
       FROM service_credits_disputes d
       LEFT JOIN service_credits_dispute_adjustments a ON a.dispute_case_id = d.id
       WHERE a.id IS NULL
       ORDER BY d.created_at DESC
       LIMIT $1`,
    [pageSize],
  );
  const names = await resolveUsernames(result.rows.map((row) => row.opened_by_user_id));
  return result.rows.map((row) => ({
    id: row.id,
    transferId: row.transfer_id,
    openedByUserId: row.opened_by_user_id,
    openedByName: names.get(row.opened_by_user_id) ?? null,
    reason: row.reason,
    createdAtIso: row.created_at.toISOString(),
  }));
}

export async function getTreasuryConfig() {
  const result = await queryDb<{ policy: Record<string, unknown> }>(
    `SELECT policy
     FROM service_credits_treasury_config
     WHERE id = TRUE
     LIMIT 1`,
  );

  return result.rows[0]?.policy ?? {};
}

function numFromRow(row: Record<string, string> | undefined, key: string): number {
  return Number(row?.[key] ?? '0');
}

// The public, non-identifying aggregates. Split out so the main metrics function stays simple.
async function computePublicCirculationMetrics(treasuryUserId: string | null) {
  const totals = await queryDb<{ issued: string; burned: string }>(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE event_type = 'mint_grant'), 0)::text AS issued,
       COALESCE(SUM(amount) FILTER (WHERE event_type = 'burn'), 0)::text AS burned
     FROM service_credits_governance_events`,
  );

  const circulation = await queryDb<{ in_circulation: string; debt: string }>(
    `SELECT
       COALESCE(SUM(available_balance + escrow_balance)
         FILTER (WHERE (available_balance + escrow_balance) > 0 AND ($1::text IS NULL OR user_id <> $1)), 0)::text AS in_circulation,
       COALESCE(SUM(-available_balance) FILTER (WHERE available_balance < 0), 0)::text AS debt
     FROM service_credits_wallets`,
    [treasuryUserId],
  );

  const treasury = treasuryUserId
    ? await queryDb<{ balance: string }>(
        `SELECT COALESCE(available_balance + escrow_balance, 0)::text AS balance
         FROM service_credits_wallets WHERE user_id = $1 LIMIT 1`,
        [treasuryUserId],
      )
    : null;

  const volume = await queryDb<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM service_credits_transfers WHERE created_at > NOW() - make_interval(days => 30)`,
  );

  const inCirculation = numFromRow(circulation.rows[0], 'in_circulation');
  const transferVolume30d = numFromRow(volume.rows[0], 'total');

  return {
    inCirculation,
    publicMetrics: {
      inCirculation,
      totalIssued: numFromRow(totals.rows[0], 'issued'),
      totalBurned: numFromRow(totals.rows[0], 'burned'),
      treasuryBalance: treasury ? numFromRow(treasury.rows[0], 'balance') : null,
      outstandingMutualCreditDebt: numFromRow(circulation.rows[0], 'debt'),
      transferVolume30d,
      velocity: inCirculation > 0 ? transferVolume30d / inCirculation : 0,
    },
  };
}

// The admin-only operator levers (mint budget, concentration, open disputes). Split out so the main
// metrics function stays simple.
async function computeAdminCirculationLevers(issuance: IssuancePolicy, treasuryUserId: string | null, inCirculation: number) {
  const ceiling = resolveMintCeiling(issuance, inCirculation);

  let mintedThisPeriod = 0;
  if (issuance.enforce) {
    const minted = await queryDb<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM service_credits_governance_events
       WHERE event_type = 'mint_grant' AND created_at > NOW() - make_interval(days => $1::int)`,
      [issuance.periodDays],
    );
    mintedThisPeriod = Number(minted.rows[0]?.total ?? '0');
  }

  const concentration = await queryDb<{ top: string }>(
    `SELECT COALESCE(SUM(bal), 0)::text AS top FROM (
       SELECT (available_balance + escrow_balance) AS bal
       FROM service_credits_wallets
       WHERE (available_balance + escrow_balance) > 0 AND ($1::text IS NULL OR user_id <> $1)
       ORDER BY bal DESC LIMIT 5
     ) top_wallets`,
    [treasuryUserId],
  );

  const disputes = await queryDb<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM service_credits_disputes`,
  );

  return {
    issuanceEnforced: issuance.enforce,
    issuancePeriodDays: issuance.periodDays,
    mintBudgetCeiling: ceiling,
    mintedThisPeriod,
    mintBudgetRemaining: ceiling === null ? null : Math.max(0, ceiling - mintedThisPeriod),
    concentrationTop5Share: inCirculation > 0 ? Number(concentration.rows[0]?.top ?? '0') / inCirculation : 0,
    openDisputes: Number(disputes.rows[0]?.total ?? '0'),
    treasuryUserIdConfigured: treasuryUserId !== null,
  };
}

// Circulation metrics for the two-tier dashboard. Without `includeAdmin` it returns only the public,
// non-identifying aggregates; with it, the operator levers are added. No figure is ever a fiat amount.
export async function getCirculationMetrics(options?: { includeAdmin?: boolean }) {
  const policy = await getTreasuryConfig();
  const treasuryUserId = readTreasuryUserId(policy);

  const { inCirculation, publicMetrics } = await computePublicCirculationMetrics(treasuryUserId);

  if (!options?.includeAdmin) {
    return publicMetrics;
  }

  const levers = await computeAdminCirculationLevers(readIssuancePolicy(policy), treasuryUserId, inCirculation);
  return { ...publicMetrics, ...levers };
}

export async function updateTreasuryConfig(input: { actorId: string; policy: Record<string, unknown> }) {
  await queryDb(
    `UPDATE service_credits_treasury_config
     SET policy = $1::jsonb, updated_by_user_id = $2, updated_at = NOW()
     WHERE id = TRUE`,
    [JSON.stringify(input.policy), input.actorId],
  );
}

// Admin-only: grant or revoke a member's mutual-credit limit. The abuse defense is that new accounts
// start at 0 (no credit line until earned), the operator raises a limit only for trusted members, and
// the policy maxLimit caps how high any single line can go. Set to 0 to revoke instantly.
export async function setCreditLimit(input: { actorId: string; targetUserId: string; creditLimit: number }) {
  if (!Number.isFinite(input.creditLimit) || input.creditLimit < 0) {
    throw new Error('invalid_payload');
  }

  // maxLimit is a hard ceiling on any per-account override, enforced even at its default of 0 — so an
  // override above an unset ceiling is blocked (the operator must set mutualCredit.maxLimit first).
  // Setting the limit to 0 (revoke) always passes.
  const mutualCredit = readMutualCreditPolicy(await getTreasuryConfig());
  if (input.creditLimit > mutualCredit.maxLimit) {
    throw new Error('credit_limit_above_max');
  }

  await queryDb(
    `INSERT INTO service_credits_credit_limits (user_id, credit_limit, updated_by_user_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET credit_limit = EXCLUDED.credit_limit, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = NOW()`,
    [input.targetUserId, input.creditLimit, input.actorId],
  );

  return { targetUserId: input.targetUserId, creditLimit: input.creditLimit };
}

// Admin-only: read a member's mutual-credit limit (the flat policy default, or a per-account override)
// and freeze state. No behavioral score is computed or returned — there is no credit/social score.
export async function getCreditLimitInfo(userId: string) {
  const policy = readMutualCreditPolicy(await getTreasuryConfig());

  const granted = await queryDb<{ credit_limit: string }>(
    `SELECT credit_limit::text FROM service_credits_credit_limits WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const restriction = await getAccountRestrictionStatus(userId, 'trading');

  return {
    targetUserId: userId,
    creditLimit: granted.rows[0] ? Number(granted.rows[0].credit_limit) : policy.defaultLimit,
    isDefault: !granted.rows[0],
    frozen: restriction.isRestricted,
  };
}

// Admin-only: freeze or unfreeze a wallet. Backed by the platform-wide restriction signal at 'trading'
// scope, so a freeze blocks spending here and is visible to any other plugin that honours the signal.
export async function setWalletFrozen(input: { actorId: string; targetUserId: string; frozen: boolean; reason?: string }) {
  if (input.frozen) {
    await restrictAccount({ targetUserId: input.targetUserId, actorId: input.actorId, reason: input.reason ?? null, scope: 'trading' });
  } else {
    await unrestrictAccount({ targetUserId: input.targetUserId, actorId: input.actorId });
  }

  return { targetUserId: input.targetUserId, frozen: input.frozen };
}

export async function insertServiceCreditsAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  await queryDb(
    `INSERT INTO service_credits_admin_audit_trail
      (id, actor_id, command, policy_status, reason, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [randomUUID(), input.actorId, input.command, input.policyStatus, input.reason, input.targetType, input.targetId, JSON.stringify(input.metadata ?? {})],
  );
}
