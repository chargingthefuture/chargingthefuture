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
 * Public circulation metrics from GET /api/service-credits/circulation.
 * All values are bare ServiceCredits quantities — never a fiat equivalent.
 * treasuryBalance is null when the treasury wallet is not configured.
 */
export type CirculationMetrics = {
  inCirculation: number;
  totalIssued: number;
  totalBurned: number;
  treasuryBalance: number | null;
  outstandingMutualCreditDebt: number;
  transferVolume30d: number;
  velocity: number;
};

type CirculationApiResponse = {
  ok: true;
  metrics: CirculationMetrics;
};

/**
 * Fetch the authenticated user's ServiceCredits wallet.
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
  rail?: 'balance' | 'mutual_credit';
}): Promise<Transfer> {
  const body: {
    recipientUserId: string;
    amount: number;
    idempotencyKey: string;
    rail?: 'mutual_credit';
  } = {
    recipientUserId: input.recipientUserId,
    amount: input.amount,
    idempotencyKey: input.idempotencyKey,
  };
  // Only send the rail field when paying on community credit; the default
  // balance rail is implied by its absence.
  if (input.rail === 'mutual_credit') {
    body.rail = 'mutual_credit';
  }
  const res = await authedFetch(`${API_BASE}/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as TransferApiResponse;
  if (!res.ok) {
    const err = data as unknown as { message?: string };
    throw new Error(err.message ?? 'service_credits_transfer_failed');
  }
  return data.transfer;
}

/**
 * Fetch the public ServiceCredits circulation metrics.
 * Returns bare credit quantities only; never a fiat figure.
 */
export async function fetchCirculation(): Promise<CirculationMetrics> {
  const res = await authedFetch(`${API_BASE}/circulation`);
  if (!res.ok) {
    throw new Error(`service_credits_circulation_fetch_failed:${res.status}`);
  }
  const data = (await res.json()) as CirculationApiResponse;
  return data.metrics;
}
