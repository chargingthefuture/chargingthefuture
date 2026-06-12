// Real API client for the Directory plugin (mobile).
// Mirrors web routes under ctf/packages/web/app/api/directory/.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socketrelay/currency.

import { authedFetch } from '../../auth/authedFetch';

const API_BASE = '/api/directory';

export type DirectoryProfileSource = 'admin' | 'self' | 'community-generated';

export interface DirectorySkill {
  id: string;
  name: string;
  displayOrder: number;
}

// Shape returned by GET /api/directory/list items array.
export interface DirectoryListItem {
  id: string;
  claimedByUserId: string | null;
  firstName: string;
  lastName: string | null;
  headline: string | null;
  bio: string | null;
  profileUrl: string | null;
  sectorId: string | null;
  sectorName: string | null;
  jobTitleId: string | null;
  jobTitleName: string | null;
  skills: DirectorySkill[];
  isActive: boolean;
  source: DirectoryProfileSource;
  invitedByUsername: string | null;
  unclaimedHandle: string | null;
  // payment addresses — used to infer "accepts credits" badge
  serviceCreditsAddress?: string | null;
  venmoAddress?: string | null;
  moneroAddress?: string | null;
  bitcoinAddress?: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface DirectoryPagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface DirectoryListResponse {
  items: DirectoryListItem[];
  pagination: DirectoryPagination;
}

export interface DirectorySector {
  id: string;
  name: string;
}

export async function fetchDirectoryList(
  opts: { page?: number; pageSize?: number; q?: string; sectorId?: string } = {},
): Promise<DirectoryListResponse> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts.q) params.set('q', opts.q);
  if (opts.sectorId) params.set('sectorId', opts.sectorId);
  const qs = params.toString();
  const url = `${API_BASE}/list${qs ? `?${qs}` : ''}`;

  const res = await authedFetch(url);
  if (!res.ok) {
    throw new Error(`directory/list ${res.status}`);
  }
  return res.json() as Promise<DirectoryListResponse>;
}

export async function fetchDirectorySectors(): Promise<DirectorySector[]> {
  const res = await authedFetch(`${API_BASE}/sectors`);
  if (!res.ok) {
    throw new Error(`directory/sectors ${res.status}`);
  }
  const data = (await res.json()) as { items: DirectorySector[] };
  return data.items;
}

// Shape returned by GET /api/directory/announcements (web lib/directory/types
// DirectoryAnnouncement, narrowed to the fields the mobile screen renders).
export interface DirectoryAnnouncement {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
  publishedAtIso: string;
  expiresAtIso: string | null;
}

export async function fetchDirectoryAnnouncements(): Promise<DirectoryAnnouncement[]> {
  const res = await authedFetch(`${API_BASE}/announcements`);
  if (!res.ok) {
    throw new Error(`directory/announcements ${res.status}`);
  }
  const data = (await res.json()) as { items: DirectoryAnnouncement[] };
  return data.items;
}

// ── Admin client ────────────────────────────────────────────────────────────
// Mirrors the admin routes under ctf/packages/web/app/api/directory/admin/.
// Every admin route is gated by requireDirectoryAdminAccess on the server, so a
// non-admin caller receives a 401/403 and these calls throw. Mutations send the
// x-ctf-csrf header the web routes require.

// Editable fields accepted by PUT /api/directory/admin/profiles/[id]. Mirrors
// DirectoryProfileInput on the web. Verified state and unclaimed handle are not
// part of this contract, so they are never sent.
export interface AdminProfileEditInput {
  firstName: string;
  lastName: string | null;
  headline: string | null;
  bio: string | null;
  profileUrl: string | null;
  sectorId: string | null;
  jobTitleId: string | null;
  skillIds: string[];
}

export async function fetchAdminDirectoryProfiles(
  opts: { page?: number; pageSize?: number; includeInactive?: boolean } = {},
): Promise<DirectoryListResponse> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts.includeInactive) params.set('includeInactive', 'true');
  const qs = params.toString();
  const res = await authedFetch(`${API_BASE}/admin/profiles${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    throw new Error(`directory/admin/profiles ${res.status}`);
  }
  return res.json() as Promise<DirectoryListResponse>;
}

export async function updateAdminDirectoryProfile(
  profileId: string,
  input: AdminProfileEditInput,
): Promise<DirectoryListItem> {
  const res = await authedFetch(`${API_BASE}/admin/profiles/${profileId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`directory/admin/profiles update ${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; profile: DirectoryListItem };
  return data.profile;
}

export async function assignAdminDirectoryProfile(
  profileId: string,
  userId: string,
): Promise<DirectoryListItem> {
  const res = await authedFetch(`${API_BASE}/admin/profiles/${profileId}/assign`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(`directory/admin/profiles assign ${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; profile: DirectoryListItem };
  return data.profile;
}

export async function deleteAdminDirectoryProfile(profileId: string): Promise<void> {
  const res = await authedFetch(`${API_BASE}/admin/profiles/${profileId}`, {
    method: 'DELETE',
    headers: {
      'x-ctf-csrf': '1',
    },
  });
  if (!res.ok) {
    throw new Error(`directory/admin/profiles delete ${res.status}`);
  }
}
