// ServiceCredits mobile API client. Mirrors the web routes under
// ctf/packages/web/app/api/service-credits/*. All calls go through authedFetch so
// the Clerk bearer token is attached and the base URL comes from runtime config
// (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

const API_BASE = '/api/service-credits';

export type Wallet = {
  userId: string;
  availableBalance: number;
  escrowBalance: number;
};

type WalletApiResponse = {
  ok: true;
  wallet: Wallet;
};

export type Transfer = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'disputed';
  escrowHoldId: string | null;
  externalLedgerTransactionId: string | null;
};

type TransferApiResponse = {
  ok: true;
  transfer: Transfer;
};

/**
 * Fetch the authenticated user's Service Credits wallet.
 * Returns availableBalance and escrowBalance from the real backend.
 */
export async function fetchWallet(): Promise<Wallet> {
  const res = await authedFetch(`${API_BASE}/wallet`);
  if (!res.ok) {
    throw new Error(`service_credits_wallet_fetch_failed:${res.status}`);
  }
  const data = (await res.json()) as WalletApiResponse;
  return data.wallet;
}

/**
 * Create a peer-to-peer credit transfer.
 * Requires x-ctf-csrf: 1 header (mirroring the web POST /api/service-credits/transfers route).
 */
export async function sendTransfer(input: {
  recipientUserId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<Transfer> {
  const res = await authedFetch(`${API_BASE}/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({
      recipientUserId: input.recipientUserId,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
    }),
  });
  const data = (await res.json()) as TransferApiResponse;
  if (!res.ok) {
    const err = data as unknown as { message?: string };
    throw new Error(err.message ?? 'service_credits_transfer_failed');
  }
  return data.transfer;
}
