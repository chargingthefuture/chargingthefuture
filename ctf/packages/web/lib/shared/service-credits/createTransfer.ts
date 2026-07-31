import { randomUUID } from 'crypto';
import { withDbTransaction } from 'lib/db/postgres';
import Decimal from 'decimal.js';

export interface CreateTransferInput {
  senderUserId: string;
  recipientUserId: string;
  amount: number;
  idempotencyKey: string;
  originPlugin?: string;
  reasonCode?: string;
}

function ensurePositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_payload');
  }
}

export async function createTransfer(input: CreateTransferInput) {

  ensurePositiveAmount(input.amount);
  if (input.senderUserId === input.recipientUserId) {
    throw new Error('self_transfer_not_allowed');
  }

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

    const senderBalance = new Decimal(balanceResult.rows[0]?.available_balance ?? '0');
    const transferAmount = new Decimal(input.amount);
    if (senderBalance.lt(transferAmount)) {
      throw new Error('insufficient_balance');
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
        input.originPlugin ?? 'service-credits',
        input.reasonCode ?? 'transfer',
      ],
    );

    if (!insertedTransfer.rows[0]) {
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
        [input.senderUserId, input.idempotencyKey],
      );
      if (!existingTransfer.rows[0]) {
        throw new Error('idempotency_violation');
      }
      return existingTransfer.rows[0];
    }

    // Deliver immediately: debit the sender and credit the recipient (total supply conserved), and
    // record the ledger debit/credit pair. Previously this only wrote a pending row and moved no funds,
    // so the recipient never received the credits.
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

    return insertedTransfer.rows[0];
  });
}
