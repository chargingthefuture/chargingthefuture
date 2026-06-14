import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  postBurnToFormance,
  postDeletionReclaimToFormance,
  postDisputeAdjustmentToFormance,
  postEscrowHoldToFormance,
  postEscrowRefundToFormance,
  postEscrowReleaseToFormance,
  postMintToFormance,
  postTreasuryFeeToFormance,
} from 'lib/service-credits/formance-ledger';

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

function ensurePositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_payload');
  }
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

export async function getOrCreateWallet(userId: string) {
  const upsert = await queryDb<WalletRow>(
    `INSERT INTO service_credits_wallets (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING user_id, available_balance::text, escrow_balance::text`,
    [userId],
  );

  return mapWallet(upsert.rows[0]);
}

export async function createTransfer(input: {
  senderUserId: string;
  recipientUserId: string;
  amount: number;
  idempotencyKey: string;
  originPlugin?: string;
  reasonCode?: string;
}) {
  ensurePositiveAmount(input.amount);

  return withDbTransaction(async (client) => {
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

    const senderBalance = Number(balanceResult.rows[0]?.available_balance ?? '0');
    if (senderBalance < input.amount) {
      throw new Error('insufficient_balance');
    }

    const transferId = randomUUID();
    const insertedTransfer = await client.query<{
      id: string;
      sender_user_id: string;
      recipient_user_id: string;
      amount: string;
      status: 'pending' | 'completed' | 'cancelled' | 'disputed';
    }>(
      `INSERT INTO service_credits_transfers (id, sender_user_id, recipient_user_id, amount, status, idempotency_key)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       ON CONFLICT (sender_user_id, idempotency_key) DO NOTHING
       RETURNING id::text, sender_user_id, recipient_user_id, amount::text, status`,
      [transferId, input.senderUserId, input.recipientUserId, input.amount, input.idempotencyKey],
    );

    if (!insertedTransfer.rows[0]) {
      const existingTransfer = await client.query<{
        id: string;
        sender_user_id: string;
        recipient_user_id: string;
        amount: string;
        status: 'pending' | 'completed' | 'cancelled' | 'disputed';
      }>(
        `SELECT id::text, sender_user_id, recipient_user_id, amount::text, status
         FROM service_credits_transfers
         WHERE sender_user_id = $1 AND idempotency_key = $2
         LIMIT 1`,
        [input.senderUserId, input.idempotencyKey],
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
        [input.idempotencyKey],
      );

      return {
        id: existingTransfer.rows[0].id,
        senderUserId: existingTransfer.rows[0].sender_user_id,
        recipientUserId: existingTransfer.rows[0].recipient_user_id,
        amount: Number(existingTransfer.rows[0].amount),
        status: existingTransfer.rows[0].status,
        escrowHoldId: existingEscrow.rows[0]?.id ?? null,
        externalLedgerTransactionId: existingOutbox.rows[0]?.provider_transaction_id ?? null,
      };
    }

    const escrowHoldId = randomUUID();
    let externalLedgerTransactionId: string | null = null;
    try {
      const externalLedger = await postEscrowHoldToFormance({
        transferId,
        senderUserId: input.senderUserId,
        recipientUserId: input.recipientUserId,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
      });
      externalLedgerTransactionId = externalLedger.transactionId;
      await writeAdapterOutbox(client, {
        commandName: 'transfer.create',
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        payload: {
          transferId,
          senderUserId: input.senderUserId,
          recipientUserId: input.recipientUserId,
          amount: input.amount,
          originPlugin: input.originPlugin ?? 'service-credits',
          reasonCode: input.reasonCode ?? 'transfer',
        },
        providerTransactionId: externalLedgerTransactionId,
      });
    } catch (error) {
      await writeAdapterOutbox(client, {
        commandName: 'transfer.create',
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        payload: {
          transferId,
          senderUserId: input.senderUserId,
          recipientUserId: input.recipientUserId,
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
      [input.senderUserId, input.amount],
    );

    await client.query(
      `INSERT INTO service_credits_escrow_holds (id, wallet_user_id, transfer_id, amount, status)
       VALUES ($1, $2, $3, $4, 'held')`,
      [escrowHoldId, input.senderUserId, transferId, input.amount],
    );

    await client.query(
      `INSERT INTO service_credits_ledger_entries (id, user_id, entry_type, amount, reference_type, reference_id, accounting_scope, metadata)
       VALUES ($1, $2, 'escrow_hold', $4, 'escrow', $3, 'service_credits_non_gdp', $5::jsonb)`,
      [
        randomUUID(),
        input.senderUserId,
        escrowHoldId,
        input.amount,
        JSON.stringify({ externalLedger: 'formance', externalLedgerTransactionId }),
      ],
    );

    const response = {
      id: transferId,
      senderUserId: input.senderUserId,
      recipientUserId: input.recipientUserId,
      amount: input.amount,
      status: 'pending' as const,
      escrowHoldId,
      externalLedgerTransactionId,
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
       VALUES ($1, $2, 'escrow_release', $4, 'escrow', $3, 'service_credits_non_gdp')`,
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
      return existing;
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
    return response;
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

    const requestedAtDate = new Date(input.requestedAt);
    if (Number.isNaN(requestedAtDate.getTime())) {
      throw new Error('invalid_payload');
    }

    const eligibleAt = new Date(requestedAtDate.getTime() + SERVICE_CREDITS_RECLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (Date.now() < eligibleAt.getTime()) {
      throw new Error('reclaim_window_not_elapsed');
    }

    await client.query(
      `INSERT INTO service_credits_wallets (user_id)
       VALUES ($1), ($2)
       ON CONFLICT (user_id) DO NOTHING`,
      [input.accountId, input.treasuryUserId],
    );

    const activeEscrows = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM service_credits_escrow_holds
       WHERE wallet_user_id = $1 AND status = 'held'`,
      [input.accountId],
    );

    if (Number(activeEscrows.rows[0]?.total ?? '0') > 0) {
      throw new Error('active_escrow_holds');
    }

    const wallet = await client.query<{ available_balance: string; escrow_balance: string }>(
      `SELECT available_balance::text, escrow_balance::text
       FROM service_credits_wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [input.accountId],
    );

    const availableBalance = Number(wallet.rows[0]?.available_balance ?? '0');
    const escrowBalance = Number(wallet.rows[0]?.escrow_balance ?? '0');
    const amountTransferred = Math.max(0, availableBalance);

    let externalLedgerTransactionId: string | null = null;
    if (amountTransferred > 0) {
      try {
        const externalLedger = await postDeletionReclaimToFormance({
          accountId: input.accountId,
          treasuryUserId: input.treasuryUserId,
          amount: amountTransferred,
          deletionRequestId: input.deletionRequestId,
          idempotencyKey: input.idempotencyKey,
        });
        externalLedgerTransactionId = externalLedger.transactionId;
        await writeAdapterOutbox(client, {
          commandName: 'account.deletion.reclaim.execute',
          idempotencyKey: input.idempotencyKey,
          status: 'delivered',
          payload: {
            accountId: input.accountId,
            treasuryUserId: input.treasuryUserId,
            amountTransferred,
            deletionRequestId: input.deletionRequestId,
            requestId: input.requestId,
            traceId: input.traceId,
          },
          providerTransactionId: externalLedgerTransactionId,
        });
      } catch (error) {
        await writeAdapterOutbox(client, {
          commandName: 'account.deletion.reclaim.execute',
          idempotencyKey: input.idempotencyKey,
          status: 'queued',
          payload: {
            accountId: input.accountId,
            treasuryUserId: input.treasuryUserId,
            amountTransferred,
            deletionRequestId: input.deletionRequestId,
          },
          lastError: error instanceof Error ? error.message : 'external_ledger_unavailable',
        });
        // Formance unavailable — keep the authoritative local ledger write and leave a durable
        // 'queued' outbox row for the reconciliation worker. Do not roll back.
      }
    }

    if (amountTransferred > 0) {
      await client.query(
        `UPDATE service_credits_wallets
         SET available_balance = available_balance - $2, updated_at = NOW()
         WHERE user_id = $1`,
        [input.accountId, amountTransferred],
      );

      await client.query(
        `UPDATE service_credits_wallets
         SET available_balance = available_balance + $2, updated_at = NOW()
         WHERE user_id = $1`,
        [input.treasuryUserId, amountTransferred],
      );
    }

    const transferId = amountTransferred > 0 ? randomUUID() : null;
    if (transferId) {
      await client.query(
        `INSERT INTO service_credits_transfers (id, sender_user_id, recipient_user_id, amount, status, idempotency_key, completed_at)
         VALUES ($1, $2, $3, $4, 'completed', $5, NOW())
         ON CONFLICT (sender_user_id, idempotency_key)
         DO NOTHING`,
        [transferId, input.accountId, input.treasuryUserId, amountTransferred, input.idempotencyKey],
      );
    }

    const tombstoneId = randomUUID();
    await client.query(
      `INSERT INTO service_credits_wallet_tombstones
        (id, account_id, deletion_request_id, final_available_balance, final_escrow_balance)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (account_id, deletion_request_id)
       DO UPDATE SET final_available_balance = EXCLUDED.final_available_balance, final_escrow_balance = EXCLUDED.final_escrow_balance`,
      [tombstoneId, input.accountId, input.deletionRequestId, availableBalance, escrowBalance],
    );

    await client.query(
      `UPDATE service_credits_wallets
       SET available_balance = 0, escrow_balance = 0, updated_at = NOW()
       WHERE user_id = $1`,
      [input.accountId],
    );

    await client.query(
      `INSERT INTO service_credits_account_deletion_reclaims
        (id, account_id, deletion_request_id, treasury_user_id, amount_transferred, transfer_id, tombstone_id, request_id, trace_id, actor_id, idempotency_key, provider_transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (account_id, deletion_request_id)
       DO UPDATE SET amount_transferred = EXCLUDED.amount_transferred, transfer_id = EXCLUDED.transfer_id, tombstone_id = EXCLUDED.tombstone_id, provider_transaction_id = EXCLUDED.provider_transaction_id`,
      [
        randomUUID(),
        input.accountId,
        input.deletionRequestId,
        input.treasuryUserId,
        amountTransferred,
        transferId,
        tombstoneId,
        input.requestId,
        input.traceId,
        input.actorId,
        input.idempotencyKey,
        externalLedgerTransactionId,
      ],
    );

    await client.query(
      `INSERT INTO service_credits_treasury_events
        (id, event_type, source_user_id, treasury_user_id, amount, transfer_id, reason_code, actor_id, idempotency_key, provider_transaction_id)
       VALUES ($1, 'deletion_reclaim', $2, $3, $4, $5, 'account_deleted_and_returned_to_treasury', $6, $7, $8)
       ON CONFLICT (event_type, actor_id, idempotency_key)
       DO NOTHING`,
      [randomUUID(), input.accountId, input.treasuryUserId, amountTransferred, transferId, input.actorId, input.idempotencyKey, externalLedgerTransactionId],
    );

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

export async function createDispute(input: { transferId: string; openedByUserId: string; reason: string }) {
  const inserted = await queryDb<{ id: string }>(
    `INSERT INTO service_credits_disputes (id, transfer_id, opened_by_user_id, reason)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text`,
    [randomUUID(), input.transferId, input.openedByUserId, input.reason.trim()],
  );

  return inserted.rows[0].id;
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

export async function updateTreasuryConfig(input: { actorId: string; policy: Record<string, unknown> }) {
  await queryDb(
    `UPDATE service_credits_treasury_config
     SET policy = $1::jsonb, updated_by_user_id = $2, updated_at = NOW()
     WHERE id = TRUE`,
    [JSON.stringify(input.policy), input.actorId],
  );
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
