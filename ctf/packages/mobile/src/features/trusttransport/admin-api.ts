import { Platform } from 'react-native';

// Admin client for the TrustTransport plugin. Mirrors the web admin routes under
// ctf/packages/web/app/api/trusttransport/admin/*. Admin access is enforced
// server-side; a 401/403 surfaces as an "admins only" notice in the screen.
const ADMIN_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/trusttransport/admin'
    : 'http://localhost:3000/api/trusttransport/admin';

// Incident shape mirrors lib/trusttransport/types.ts TrustTransportIncident.
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

// Market config shape mirrors lib/trusttransport/types.ts TrustTransportMarketConfig.
export type TrustTransportMarketConfig = {
  maxConcurrentTrips: number;
  requireProofOnDelivery: boolean;
  emergencyFreezeEnabled: boolean;
};

// Audit event shape mirrors the row mapping in lib/trusttransport/repository.ts listAuditEvents.
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

function authHeaders(authToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
}

function mutationHeaders(authToken: string): Record<string, string> {
  return {
    ...authHeaders(authToken),
    'x-ctf-csrf': '1',
  };
}

// GET the recent incidents (disputes + risk signals). Returns forbidden:true for non-admins.
export async function fetchAdminIncidents(authToken: string): Promise<AdminListResult<TrustTransportIncident>> {
  const res = await fetch(`${ADMIN_API_BASE}/incidents`, { headers: authHeaders(authToken) });
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
export async function fetchAdminMarketConfig(authToken: string): Promise<AdminConfigResult> {
  const res = await fetch(`${ADMIN_API_BASE}/market-config`, { headers: authHeaders(authToken) });
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
export async function fetchAdminAuditEvents(authToken: string): Promise<AdminListResult<TrustTransportAuditEvent>> {
  const res = await fetch(`${ADMIN_API_BASE}/audit-events`, { headers: authHeaders(authToken) });
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
  authToken: string,
  incidentId: string,
  resolutionNotes: string | null,
): Promise<void> {
  const res = await fetch(`${ADMIN_API_BASE}/incidents/${incidentId}/resolve`, {
    method: 'POST',
    headers: mutationHeaders(authToken),
    body: JSON.stringify({ resolutionNotes }),
  });
  if (!res.ok) {
    throw new Error(`incident_resolve_failed:${res.status}`);
  }
}

// POST restrict an account. Carries the CSRF confirmation header the API requires.
export async function restrictAdminAccount(
  authToken: string,
  userId: string,
  reason: string | null,
): Promise<void> {
  const res = await fetch(`${ADMIN_API_BASE}/accounts/${userId}/restrict`, {
    method: 'POST',
    headers: mutationHeaders(authToken),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    throw new Error(`account_restrict_failed:${res.status}`);
  }
}

// POST restore a restricted account. Carries the CSRF confirmation header the API requires.
export async function restoreAdminAccount(authToken: string, userId: string): Promise<void> {
  const res = await fetch(`${ADMIN_API_BASE}/accounts/${userId}/restore`, {
    method: 'POST',
    headers: mutationHeaders(authToken),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`account_restore_failed:${res.status}`);
  }
}

// PUT update the market config. Carries the CSRF confirmation header the API requires.
export async function updateAdminMarketConfig(
  authToken: string,
  input: TrustTransportMarketConfig,
): Promise<TrustTransportMarketConfig> {
  const res = await fetch(`${ADMIN_API_BASE}/market-config`, {
    method: 'PUT',
    headers: mutationHeaders(authToken),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`market_config_update_failed:${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; config: TrustTransportMarketConfig };
  return data.config;
}
