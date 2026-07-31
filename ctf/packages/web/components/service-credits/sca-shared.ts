// Shared helpers and types for the ServiceCredits admin surface (/admin/service-credits).
// This is the money core: governance mint/burn, treasury fee collection, and dispute
// adjustments. Every mutation carries the CSRF confirmation header the API requires and
// is gated behind an explicit confirm step in the UI. We never render a credits→fiat
// equivalence and never fabricate amounts — every value comes from operator input or a
// real endpoint response.

export type AdminMutationResult<T = unknown> = { ok: boolean; message?: string; data?: T };

// All admin mutations carry the CSRF confirmation header the API requires (x-ctf-csrf: '1').
export async function scAdminMutate<T = unknown>(
  url: string,
  method: 'POST' | 'PUT',
  body?: unknown,
): Promise<AdminMutationResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | ({ ok?: boolean; message?: string; reason?: string; code?: string } & Record<string, unknown>)
      | null;
    if (res.ok) {
      return { ok: true, data: (data as T) ?? undefined };
    }
    return {
      ok: false,
      message: data?.message ?? data?.reason ?? data?.code ?? `Request failed (${res.status}).`,
    };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}

// A stable, unique idempotency key for a single mutation attempt. The server treats a
// repeated key as the same command, so a fresh key is generated per submission.
export function newIdempotencyKey(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

// Treasury config is an open-ended JSON policy object the server stores verbatim.
export type TreasuryConfigResponse = { ok: boolean; treasuryConfig: Record<string, unknown> };

export type MintGrantResponse = {
  ok: boolean;
  grant?: {
    governanceEventId: string;
    mintStatus: string;
    mintedAt: string;
    externalLedgerTransactionId: string | null;
  };
};

export type BurnResponse = {
  ok: boolean;
  burn?: {
    governanceEventId: string;
    [key: string]: unknown;
  };
};

export type TreasuryFeeResponse = {
  ok: boolean;
  collection?: {
    treasuryEventId: string;
    transferId: string;
    [key: string]: unknown;
  };
};

// Admin circulation view: the public aggregates plus the operator levers. No fiat equivalent.
export type AdminCirculationMetrics = {
  inCirculation: number;
  totalIssued: number;
  totalBurned: number;
  treasuryBalance: number | null;
  outstandingMutualCreditDebt: number;
  transferVolume30d: number;
  velocity: number;
  issuanceEnforced: boolean;
  issuancePeriodDays: number;
  mintBudgetCeiling: number | null;
  mintedThisPeriod: number;
  mintBudgetRemaining: number | null;
  concentrationTop5Share: number;
  openDisputes: number;
  treasuryUserIdConfigured: boolean;
};

export type AdminCirculationResponse = { ok: boolean; metrics?: AdminCirculationMetrics };

export type CreditLimitResponse = {
  ok: boolean;
  creditLimit?: { targetUserId: string; creditLimit: number; [key: string]: unknown };
};

// Look-up view of a member's mutual-credit limit (the flat policy default or a per-account override)
// and freeze state. No behavioral score — there is no credit/social score on this platform.
export type CreditLimitLookup = {
  targetUserId: string;
  creditLimit: number;
  isDefault: boolean;
  frozen: boolean;
};

export type CreditLimitLookupResponse = {
  ok: boolean;
  creditLimit?: CreditLimitLookup;
};

// Wallet status: a frozen wallet cannot spend ServiceCredits on either rail.
export type WalletStatusResponse = {
  ok: boolean;
  walletStatus?: { targetUserId: string; frozen: boolean; [key: string]: unknown };
};

export type DisputeAdjustmentResponse = {
  ok: boolean;
  adjustment?: {
    adjustmentId: string;
    transferId: string;
    [key: string]: unknown;
  };
};
