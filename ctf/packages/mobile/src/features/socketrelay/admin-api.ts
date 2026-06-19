import { authedFetch } from '../../auth/authedFetch';

// Admin client for the SocketRelay plugin. Binds only to the real web admin routes
// under ctf/packages/web/app/api/socketrelay/admin/*. Admin access is enforced
// server-side; a 401/403 surfaces as an "admins only" notice in the screen.
//
// Mirrored endpoints:
//   GET    /api/socketrelay/admin/requests          (paged request list)
//   DELETE /api/socketrelay/admin/requests/:id       (delete a request — destructive)
//   GET    /api/socketrelay/admin/fulfillments        (fulfillment list)
//
// Mutations carry the x-ctf-csrf:'1' confirmation header the API requires.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).
const ADMIN_API_BASE = '/api/socketrelay/admin';

// ---------------------------------------------------------------------------
// Types — mirroring the web repository return shapes (SocketRelayFulfillment,
// SocketRelayRequest) so the screen renders real fields only.
// ---------------------------------------------------------------------------

export type SocketRelayRequestStatus = 'open' | 'claimed' | 'closed' | 'cancelled';

export type AdminRequest = {
  id: string;
  ownerUserId: string;
  ownerUsername: string | null;
  title: string;
  details: string;
  category: string;
  city: string | null;
  isPublic: boolean;
  status: SocketRelayRequestStatus;
  reopenedCount: number;
  claimedFulfillmentId: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type AdminFulfillmentStatus = 'active' | 'closed' | 'cancelled';

export type AdminFulfillment = {
  id: string;
  requestId: string;
  requesterUserId: string;
  fulfillerUserId: string;
  status: AdminFulfillmentStatus;
  closeReason: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type AdminFetchResult = {
  ok: boolean;
  forbidden: boolean;
  message: string | null;
  requests: AdminRequest[];
  requestsTotal: number;
  fulfillments: AdminFulfillment[];
};

type RequestsResponse = {
  ok: boolean;
  items: AdminRequest[];
  page: number;
  pageSize: number;
  total: number;
};

type FulfillmentsResponse = { ok: boolean; items: AdminFulfillment[] };

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// Loads the same two datasets the web admin page reads (requests, fulfillments).
// A 401/403 on any read means the caller is not an admin.
export async function fetchAdminOverview(): Promise<AdminFetchResult> {
  const empty: AdminFetchResult = {
    ok: false,
    forbidden: false,
    message: null,
    requests: [],
    requestsTotal: 0,
    fulfillments: [],
  };

  const [requestsRes, fulfillmentsRes] = await Promise.all([
    authedFetch(`${ADMIN_API_BASE}/requests?page=1&pageSize=100`, { headers: JSON_HEADERS }),
    authedFetch(`${ADMIN_API_BASE}/fulfillments`, { headers: JSON_HEADERS }),
  ]);

  if (
    requestsRes.status === 401 ||
    requestsRes.status === 403 ||
    fulfillmentsRes.status === 401 ||
    fulfillmentsRes.status === 403
  ) {
    return { ...empty, forbidden: true, message: 'Admin access is required.' };
  }

  if (!requestsRes.ok || !fulfillmentsRes.ok) {
    return { ...empty, message: 'Could not load the SocketRelay admin data.' };
  }

  const requestsData = (await requestsRes.json()) as RequestsResponse;
  const fulfillmentsData = (await fulfillmentsRes.json()) as FulfillmentsResponse;

  return {
    ok: true,
    forbidden: false,
    message: null,
    requests: requestsData.items ?? [],
    requestsTotal: requestsData.total ?? (requestsData.items?.length ?? 0),
    fulfillments: fulfillmentsData.items ?? [],
  };
}

// DELETE a request. Destructive — the screen requires a confirm gesture before
// calling this. Carries the CSRF confirmation header the API requires.
export async function deleteAdminRequest(requestId: string): Promise<void> {
  const res = await authedFetch(`${ADMIN_API_BASE}/requests/${requestId}`, {
    method: 'DELETE',
    headers: {
      ...JSON_HEADERS,
      'x-ctf-csrf': '1',
    },
  });
  if (!res.ok) {
    throw new Error(`request_delete_failed:${res.status}`);
  }
}
