import { authedFetch } from '../../auth/authedFetch';

// Admin client for the ServiceCredits plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/service-credits/admin/*. Admin access is enforced server-side;
// a 401/403 surfaces as a "forbidden" notice in the screen. Every mutation carries the
// CSRF confirmation header the API requires (x-ctf-csrf: '1'). This is the money core, so
// the client never invents amounts and never derives a credits→fiat equivalence.
//
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
const ADMIN_API_BASE = '/api/service-credits/admin';

export type AdminResult<T> = {
  ok: boolean;
  forbidden: boolean;
  data: T | null;
  message: string | null;
};

function idempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function adminGet<T>(path: string): Promise<AdminResult<T>> {
  try {
    const res = await authedFetch(`${ADMIN_API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, forbidden: true, data: null, message: 'Admin access is required.' };
    }
    const data = (await res.json().catch(() => null)) as
      | ({ ok?: boolean; message?: string; reason?: string; code?: string } & Record<string, unknown>)
      | null;
    if (!res.ok) {
      return {
        ok: false,
        forbidden: false,
        data: null,
        message: data?.message ?? data?.reason ?? data?.code ?? `Request failed (${res.status}).`,
      };
    }
    return { ok: true, forbidden: false, data: (data as T) ?? null, message: null };
  } catch {
    return { ok: false, forbidden: false, data: null, message: 'Network error. Try again.' };
  }
}

async function adminPost<T>(path: string, body: Record<string, unknown>): Promise<AdminResult<T>> {
  try {
    const res = await authedFetch(`${ADMIN_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, forbidden: true, data: null, message: 'Admin access is required.' };
    }
    const data = (await res.json().catch(() => null)) as
      | ({ ok?: boolean; message?: string; reason?: string; code?: string } & Record<string, unknown>)
      | null;
    if (!res.ok) {
      return {
        ok: false,
        forbidden: false,
        data: null,
        message: data?.message ?? data?.reason ?? data?.code ?? `Request failed (${res.status}).`,
      };
    }
    return { ok: true, forbidden: false, data: (data as T) ?? null, message: null };
  } catch {
    return { ok: false, forbidden: false, data: null, message: 'Network error. Try again.' };
  }
}

// GET the treasury policy config. Also doubles as the admin-access probe for the screen.
export type TreasuryConfigResult = AdminResult<{ treasuryConfig: Record<string, unknown> }>;
export async function fetchTreasuryConfig(): Promise<TreasuryConfigResult> {
  try {
    const res = await authedFetch(`${ADMIN_API_BASE}/treasury`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, forbidden: true, data: null, message: 'Admin access is required.' };
    }
    if (!res.ok) {
      return { ok: false, forbidden: false, data: null, message: `Could not load treasury config (${res.status}).` };
    }
    const data = (await res.json()) as { ok: boolean; treasuryConfig: Record<string, unknown> };
    return { ok: true, forbidden: false, data: { treasuryConfig: data.treasuryConfig ?? {} }, message: null };
  } catch {
    return { ok: false, forbidden: false, data: null, message: 'Network error. Try again.' };
  }
}

export type GovernanceEvent = { governanceEventId: string };
export function mintGrant(
  input: { targetUserId: string; amount: number; grantReason: string; governanceTicketId: string },
): Promise<AdminResult<{ grant: GovernanceEvent }>> {
  return adminPost('/governance/mint-grants', { ...input, idempotencyKey: idempotencyKey('mint') });
}

export function burnCredits(
  input: { targetUserId: string; amount: number; burnReason: string; governanceTicketId: string },
): Promise<AdminResult<{ burn: GovernanceEvent }>> {
  return adminPost('/governance/burns', { ...input, idempotencyKey: idempotencyKey('burn') });
}

export type TreasuryEvent = { treasuryEventId: string; transferId: string };
export function collectFee(
  input: { sourceUserId: string; treasuryUserId: string; amount: number; feeReasonCode: string; originPlugin: string },
): Promise<AdminResult<{ collection: TreasuryEvent }>> {
  return adminPost('/treasury/fees/collect', { ...input, idempotencyKey: idempotencyKey('fee') });
}

export type DisputeAdjustment = { adjustmentId: string; transferId: string };
export function applyDisputeAdjustment(
  input: { disputeCaseId: string; sourceUserId: string; destinationUserId: string; amount: number; adjustmentReason: string },
): Promise<AdminResult<{ adjustment: DisputeAdjustment }>> {
  return adminPost('/disputes/adjustments', { ...input, idempotencyKey: idempotencyKey('dispute') });
}

// Admin circulation metrics: the public fields plus operator-only issuance levers.
// All values are bare ServiceCredits quantities; no fiat equivalence is ever derived.
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
export function fetchAdminCirculation(): Promise<AdminResult<{ metrics: AdminCirculationMetrics }>> {
  return adminGet('/circulation');
}

export type CreditLimit = {
  targetUserId: string;
  creditLimit: number;
  isDefault: boolean;
  frozen: boolean;
};
export function fetchCreditLimit(targetUserId: string): Promise<AdminResult<{ creditLimit: CreditLimit }>> {
  return adminGet(`/credit-limits?targetUserId=${encodeURIComponent(targetUserId)}`);
}

export function setCreditLimit(
  input: { targetUserId: string; creditLimit: number },
): Promise<AdminResult<{ creditLimit: { targetUserId: string; creditLimit: number } }>> {
  return adminPost('/credit-limits', input);
}

export type WalletStatus = { targetUserId: string; frozen: boolean };
export function setWalletStatus(
  input: { targetUserId: string; frozen: boolean; reason?: string },
): Promise<AdminResult<{ walletStatus: WalletStatus }>> {
  return adminPost('/wallet-status', input);
}
