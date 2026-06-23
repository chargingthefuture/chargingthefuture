// Real API client for the Directory plugin (mobile).
// Mirrors web routes under ctf/packages/web/app/api/directory/.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socketrelay/currency.

import { authedFetch } from '../../auth/authedFetch';
import type { TrustUserExtension } from '../trust/api';

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
  // Free-text skills nominated through Skills Hunt that are not yet in the taxonomy (still a
  // proposal in skills_hunt_proposed_skill_promotions). Rendered as muted "pending review" chips so
  // a community-generated profile's Specializations is never empty. Optional for older payloads.
  pendingSkills?: string[];
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

// ── Cross-plugin presence + member trust (profile detail) ─────────────────────

// A single cross-plugin presence entry: where a member is active, with a deep link into that plugin.
// Mirrors the web MemberPresenceEntry returned by GET /api/presence/user/[userId].
export interface MemberPresenceEntry {
  pluginSlug: string;
  refType: string;
  refId: string;
  label: string;
  deepLink: string;
}

// Where else this member is active across plugins. Best-effort: the route returns an empty list on
// failure, and any error here resolves to [] so the profile still renders.
export async function fetchMemberPresence(userId: string): Promise<MemberPresenceEntry[]> {
  try {
    const res = await authedFetch(`/api/presence/user/${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { presence?: MemberPresenceEntry[] };
    return data.presence ?? [];
  } catch {
    return [];
  }
}

// Another member's trust panel. GET /api/trust/user/[userId]:
//   200 → the trust object (visible: the member is public, or the viewer is the owner / an admin)
//   403 → restricted (the member limits who can view their trust)
//   else (401 / 503 / network) → hidden (show nothing)
export type MemberTrustState =
  | { kind: 'ready'; trust: TrustUserExtension }
  | { kind: 'restricted' }
  | { kind: 'hidden' };

export async function fetchMemberTrust(userId: string): Promise<MemberTrustState> {
  try {
    const res = await authedFetch(`/api/trust/user/${encodeURIComponent(userId)}`);
    if (res.status === 403) return { kind: 'restricted' };
    if (!res.ok) return { kind: 'hidden' };
    const trust = (await res.json()) as TrustUserExtension;
    return { kind: 'ready', trust };
  } catch {
    return { kind: 'hidden' };
  }
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
