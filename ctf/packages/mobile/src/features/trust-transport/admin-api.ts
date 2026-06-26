// Admin client for the TrustTransport plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/trust-transport/admin/*. Admin access is enforced
// server-side; a 401/403 surfaces as an "admins only" notice in the screen.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

const BASE = '/api/trust-transport/admin';

// Incident shape mirrors lib/trust-transport/types.ts TrustTransportIncident.
export type TrustTransportIncident = {
  id: string;
  kind: 'dispute' | 'risk_signal';
  status: 'open' | 'resolved' | 'dismissed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  requestId: string | null;
  tripId: string | null;
  openedByUserId: string;
  createdAtIso: string;
};

// Market config shape mirrors lib/trust-transport/types.ts TrustTransportMarketConfig.
export type TrustTransportMarketConfig = {
  maxConcurrentTrips: number;
  requireProofOnDelivery: boolean;
  emergencyFreezeEnabled: boolean;
};

// Audit event shape mirrors the row mapping in lib/trust-transport/repository.ts listAuditEvents.
export type TrustTransportAuditEvent = {
  id: string;
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAtIso: string;
};

export type AdminListResult<T> = {
  ok: boolean;
  forbidden: boolean;
  items: T[];
  message: string | null;
};

export type AdminConfigResult = {
  ok: boolean;
  forbidden: boolean;
  config: TrustTransportMarketConfig | null;
  message: string | null;
};

const MUTATION_HEADERS = {
  'Content-Type': 'application/json',
  'x-ctf-csrf': '1',
};

// GET the recent incidents (disputes + risk signals). Returns forbidden:true for non-admins.
export async function fetchAdminIncidents(): Promise<AdminListResult<TrustTransportIncident>> {
  const res = await authedFetch(`${BASE}/incidents`);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, items: [], message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, items: [], message: `Could not load incidents (${res.status}).` };
  }
  const data = (await res.json()) as { ok: boolean; items: TrustTransportIncident[] };
  return { ok: true, forbidden: false, items: data.items ?? [], message: null };
}

// GET the current market config. Returns forbidden:true for non-admins.
export async function fetchAdminMarketConfig(): Promise<AdminConfigResult> {
  const res = await authedFetch(`${BASE}/market-config`);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, config: null, message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, config: null, message: `Could not load market config (${res.status}).` };
  }
  const data = (await res.json()) as { ok: boolean; config: TrustTransportMarketConfig };
  return { ok: true, forbidden: false, config: data.config ?? null, message: null };
}

// GET the recent admin audit trail. Returns forbidden:true for non-admins.
export async function fetchAdminAuditEvents(): Promise<AdminListResult<TrustTransportAuditEvent>> {
  const res = await authedFetch(`${BASE}/audit-events`);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, forbidden: true, items: [], message: 'Admin access is required.' };
  }
  if (!res.ok) {
    return { ok: false, forbidden: false, items: [], message: `Could not load audit events (${res.status}).` };
  }
  const data = (await res.json()) as { ok: boolean; items: TrustTransportAuditEvent[] };
  return { ok: true, forbidden: false, items: data.items ?? [], message: null };
}

// POST resolve an open incident. Carries the CSRF confirmation header the API requires.
export async function resolveAdminIncident(
  incidentId: string,
  resolutionNotes: string | null,
): Promise<void> {
  const res = await authedFetch(`${BASE}/incidents/${incidentId}/resolve`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify({ resolutionNotes }),
  });
  if (!res.ok) {
    throw new Error(`incident_resolve_failed:${res.status}`);
  }
}

// POST restrict an account. Carries the CSRF confirmation header the API requires.
export async function restrictAdminAccount(
  userId: string,
  reason: string | null,
): Promise<void> {
  const res = await authedFetch(`${BASE}/accounts/${userId}/restrict`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    throw new Error(`account_restrict_failed:${res.status}`);
  }
}

// POST restore a restricted account. Carries the CSRF confirmation header the API requires.
export async function restoreAdminAccount(userId: string): Promise<void> {
  const res = await authedFetch(`${BASE}/accounts/${userId}/restore`, {
    method: 'POST',
    headers: MUTATION_HEADERS,
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`account_restore_failed:${res.status}`);
  }
}

// PUT update the market config. Carries the CSRF confirmation header the API requires.
export async function updateAdminMarketConfig(
  input: TrustTransportMarketConfig,
): Promise<TrustTransportMarketConfig> {
  const res = await authedFetch(`${BASE}/market-config`, {
    method: 'PUT',
    headers: MUTATION_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`market_config_update_failed:${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; config: TrustTransportMarketConfig };
  return data.config;
}
