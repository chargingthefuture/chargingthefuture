// Admin client for the Foundation plugin. Binds only to the real web admin routes
// under ctf/packages/web/app/api/foundation/admin/*. Admin access is enforced
// server-side by requireFoundationAdminAccess; a 401/403 surfaces as an "admins
// only" notice in the screen.
//
// Mirrored endpoints:
//   GET  /api/foundation/admin/capacity-policy            (read the capacity policy)
//   PUT  /api/foundation/admin/capacity-policy            (edit the capacity policy — mutation)
//   GET  /api/foundation/admin/audit-events?limit=100      (read-only admin audit trail)
//   POST /api/foundation/admin/rate-limits/evaluate        (diagnostic rate-limit check — mutation)
//
// Mutations carry the x-ctf-csrf:'1' confirmation header the API requires (checked
// server-side by ensureMutationCsrf). All calls go through authedFetch so the Clerk
// bearer token is attached and the base URL comes from runtime config (APP_URL).
//
// Not bound (no HTTP route exists): the admin dashboard snapshot (providersTotal,
// threadsTotal, quotesTotal, activeCallsTotal, pendingNotificationsTotal) is read on
// the web only via the server-side repository getFoundationDashboard() inside the
// page component — there is no /api/foundation/admin route for it, so the mobile
// client cannot fetch it. It is intentionally omitted here (see inventory Gaps).
import { authedFetch } from '../../auth/authedFetch';

const BASE = '/api/foundation/admin';

const MUTATION_HEADERS = {
  'Content-Type': 'application/json',
  'x-ctf-csrf': '1',
};

// Capacity policy shape mirrors lib/foundation/types.ts FoundationCapacityPolicy.
export type FoundationQuotaState = 'green' | 'yellow' | 'orange' | 'red';

export type FoundationCapacityPolicy = {
  maxActiveThreadsPerUser: number;
  maxMessagesPerMinute: number;
  maxSearchesPerMinute: number;
  maxQuoteTransitionsPerMinute: number;
  maxCallDurationMinutes: number;
  quotaState: FoundationQuotaState;
  updatedAtIso: string;
};

// The editable subset the PUT route validates (full policy minus the server-set updatedAtIso).
export type FoundationCapacityPolicyInput = {
  maxActiveThreadsPerUser: number;
  maxMessagesPerMinute: number;
  maxSearchesPerMinute: number;
  maxQuoteTransitionsPerMinute: number;
  maxCallDurationMinutes: number;
  quotaState: FoundationQuotaState;
};

// Audit event shape mirrors the row mapping in lib/foundation/repository.ts
// listFoundationAuditEvents (no id column — the row is keyed by actor + time).
export type FoundationAuditEvent = {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAtIso: string;
};

// Result of the diagnostic rate-limit evaluation (evaluateRateLimitCommand).
export type FoundationRateLimitEvaluation = {
  allowed: boolean;
  currentCount: number;
  limit: number;
  thresholdBand: FoundationQuotaState;
};

export type AdminPolicyResult = {
  ok: boolean;
  forbidden: boolean;
  policy: FoundationCapacityPolicy | null;
  message: string | null;
};

export type AdminAuditResult = {
  ok: boolean;
  forbidden: boolean;
  items: FoundationAuditEvent[];
  message: string | null;
};

// GET the current capacity policy. Returns forbidden:true for non-admins.
export async function fetchAdminCapacityPolicy(): Promise<AdminPolicyResult> {
  const res = await authedFetch(`${BASE}/capacity-policy`);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, policy: null, message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, policy: null, message: `Could not load the capacity policy (${res.status}).` };
  }
  const data = (await res.json()) as { ok: boolean; policy: FoundationCapacityPolicy };
  return { ok: true, forbidden: false, policy: data.policy ?? null, message: null };
}

// GET the recent admin audit trail. Returns forbidden:true for non-admins.
export async function fetchAdminAuditEvents(limit = 100): Promise<AdminAuditResult> {
  const res = await authedFetch(`${BASE}/audit-events?limit=${encodeURIComponent(String(limit))}`);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, items: [], message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, items: [], message: `Could not load audit events (${res.status}).` };
  }
  const data = (await res.json()) as { ok: boolean; items: FoundationAuditEvent[] };
  return { ok: true, forbidden: false, items: data.items ?? [], message: null };
}

// PUT the full capacity policy. Carries the CSRF confirmation header the API
// requires; the server records the change in the audit trail.
export async function updateAdminCapacityPolicy(
  input: FoundationCapacityPolicyInput,
): Promise<FoundationCapacityPolicy> {
  const res = await authedFetch(`${BASE}/capacity-policy`, {
    method: 'PUT',
    headers: MUTATION_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`capacity_policy_update_failed:${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; policy: FoundationCapacityPolicy };
  return data.policy;
}

// POST a diagnostic rate-limit evaluation for a member + command. This is a
// mutation (it records an audit row and counts against the member's window), so the
// screen confirm-gates it before calling. Carries the CSRF confirmation header.
export async function evaluateAdminRateLimit(input: {
  userId: string;
  commandName: string;
  limit: number;
  windowSeconds: number;
}): Promise<FoundationRateLimitEvaluation> {
  const res = await authedFetch(`${BASE}/rate-limits/evaluate`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`rate_limit_evaluate_failed:${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean } & FoundationRateLimitEvaluation;
  return {
    allowed: data.allowed,
    currentCount: data.currentCount,
    limit: data.limit,
    thresholdBand: data.thresholdBand,
  };
}
