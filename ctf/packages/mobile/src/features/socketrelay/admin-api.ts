import { Platform } from 'react-native';

// Admin client for the SocketRelay plugin. Binds only to the real web admin routes
// under ctf/packages/web/app/api/socketrelay/admin/*. Admin access is enforced
// server-side; a 401/403 surfaces as an "admins only" notice in the screen.
//
// Mirrored endpoints:
//   GET    /api/socketrelay/admin/requests          (paged request list)
//   DELETE /api/socketrelay/admin/requests/:id       (delete a request — destructive)
//   GET    /api/socketrelay/admin/fulfillments        (fulfillment list)
//   GET    /api/socketrelay/admin/announcements        (plugin-targeted announcements)
//
// Mutations carry the x-ctf-csrf:'1' confirmation header the API requires.
const ADMIN_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/socketrelay/admin'
    : 'http://localhost:3000/api/socketrelay/admin';

// ---------------------------------------------------------------------------
// Types — mirroring the web repository return shapes (SocketRelayFulfillment,
// SocketRelayRequest, Announcement) so the screen renders real fields only.
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

export type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  priority: number;
  mandatory: boolean;
  expiresAtIso: string | null;
  createdAtIso: string;
};

export type AdminFetchResult = {
  ok: boolean;
  forbidden: boolean;
  message: string | null;
  requests: AdminRequest[];
  requestsTotal: number;
  fulfillments: AdminFulfillment[];
  announcements: AdminAnnouncement[];
};

type RequestsResponse = {
  ok: boolean;
  items: AdminRequest[];
  page: number;
  pageSize: number;
  total: number;
};

type FulfillmentsResponse = { ok: boolean; items: AdminFulfillment[] };
type AnnouncementsResponse = { ok: boolean; items: AdminAnnouncement[] };

function authHeaders(authToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
}

// Loads the same three datasets the web admin page reads (requests, fulfillments,
// announcements). A 401/403 on any read means the caller is not an admin.
export async function fetchAdminOverview(authToken: string): Promise<AdminFetchResult> {
  const empty: AdminFetchResult = {
    ok: false,
    forbidden: false,
    message: null,
    requests: [],
    requestsTotal: 0,
    fulfillments: [],
    announcements: [],
  };

  const headers = authHeaders(authToken);

  const [requestsRes, fulfillmentsRes, announcementsRes] = await Promise.all([
    fetch(`${ADMIN_API_BASE}/requests?page=1&pageSize=100`, { headers }),
    fetch(`${ADMIN_API_BASE}/fulfillments`, { headers }),
    fetch(`${ADMIN_API_BASE}/announcements`, { headers }),
  ]);

  if (
    requestsRes.status === 401 ||
    requestsRes.status === 403 ||
    fulfillmentsRes.status === 401 ||
    fulfillmentsRes.status === 403 ||
    announcementsRes.status === 401 ||
    announcementsRes.status === 403
  ) {
    return { ...empty, forbidden: true, message: 'Admin access is required.' };
  }

  if (!requestsRes.ok || !fulfillmentsRes.ok || !announcementsRes.ok) {
    return { ...empty, message: 'Could not load the SocketRelay admin data.' };
  }

  const requestsData = (await requestsRes.json()) as RequestsResponse;
  const fulfillmentsData = (await fulfillmentsRes.json()) as FulfillmentsResponse;
  const announcementsData = (await announcementsRes.json()) as AnnouncementsResponse;

  return {
    ok: true,
    forbidden: false,
    message: null,
    requests: requestsData.items ?? [],
    requestsTotal: requestsData.total ?? (requestsData.items?.length ?? 0),
    fulfillments: fulfillmentsData.items ?? [],
    announcements: announcementsData.items ?? [],
  };
}

// DELETE a request. Destructive — the screen requires a confirm gesture before
// calling this. Carries the CSRF confirmation header the API requires.
export async function deleteAdminRequest(authToken: string, requestId: string): Promise<void> {
  const res = await fetch(`${ADMIN_API_BASE}/requests/${requestId}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(authToken),
      'x-ctf-csrf': '1',
    },
  });
  if (!res.ok) {
    throw new Error(`request_delete_failed:${res.status}`);
  }
}
