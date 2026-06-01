// Skills Taxonomy mobile API client.
//
// Targets the same /api/skills-taxonomy/* endpoints as the web shell.
// Auth is handled by the platform wrapper (cookies on web; session token on native).
//
// Native builds resolve the API origin from EXPO_PUBLIC_API_ORIGIN
// (Expo public-env convention; falls back to localhost for dev).

import { Platform } from 'react-native';

function getApiOrigin(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env
      ? (process.env.EXPO_PUBLIC_API_ORIGIN ?? process.env.API_ORIGIN)
      : undefined;
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/$/, '') : 'http://localhost:3000';
}

const API_BASE =
  Platform.OS === 'web'
    ? '/api/skills-taxonomy'
    : `${getApiOrigin()}/api/skills-taxonomy`;

// ---------------------------------------------------------------------------
// Types — mirror TaxonomyHierarchy* from ctf/packages/web/lib/skills-taxonomy/types.ts
// ---------------------------------------------------------------------------

export type TaxonomyHierarchySkill = {
  id: string;
  name: string;
  displayOrder: number;
  aliases: string[];
  isActive: boolean;
};

export type TaxonomyHierarchyJobTitle = {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  skills: TaxonomyHierarchySkill[];
};

export type TaxonomyHierarchySector = {
  id: string;
  name: string;
  displayOrder: number;
  workforceShare: number | null;
  isActive: boolean;
  jobTitles: TaxonomyHierarchyJobTitle[];
};

export type HierarchyResponse = {
  items: TaxonomyHierarchySector[];
  generatedAt: string;
};

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const SkillsTaxonomyApi = {
  /**
   * GET /api/skills-taxonomy/hierarchy
   * Returns nested sector → jobTitle → skill tree.
   * Response shape: { items: TaxonomyHierarchySector[], generatedAt: string }
   */
  getHierarchy: (includeInactive = false) =>
    getJson<HierarchyResponse>(`/hierarchy${includeInactive ? '?includeInactive=true' : ''}`),
};
