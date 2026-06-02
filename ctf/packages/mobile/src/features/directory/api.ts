// Real API client for the Directory plugin (mobile).
// Mirrors web routes under ctf/packages/web/app/api/directory/.
// Authentication tokens must be passed from the host auth context.

import { Platform } from 'react-native';

const API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/directory'
    : 'http://localhost:3000/api/directory';

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
  authToken: string,
  opts: { page?: number; pageSize?: number; q?: string; sectorId?: string } = {},
): Promise<DirectoryListResponse> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts.q) params.set('q', opts.q);
  if (opts.sectorId) params.set('sectorId', opts.sectorId);
  const qs = params.toString();
  const url = `${API_BASE}/list${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    throw new Error(`directory/list ${res.status}`);
  }
  return res.json() as Promise<DirectoryListResponse>;
}

export async function fetchDirectorySectors(authToken: string): Promise<DirectorySector[]> {
  const res = await fetch(`${API_BASE}/sectors`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    throw new Error(`directory/sectors ${res.status}`);
  }
  const data = (await res.json()) as { items: DirectorySector[] };
  return data.items;
}
