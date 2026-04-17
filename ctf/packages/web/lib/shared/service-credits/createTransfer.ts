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
        throw new Error('idempotency_violation');
      }
      return existingTransfer.rows[0];
    }

    return insertedTransfer.rows[0];
  });
}
