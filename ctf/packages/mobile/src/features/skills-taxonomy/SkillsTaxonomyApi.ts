// Skills Taxonomy mobile API client.
//
// Targets the same /api/skills-taxonomy/* endpoints as the web shell.
// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL).

import { authedFetchJson } from '../../auth/authedFetch';

const BASE = '/api/skills-taxonomy';

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

// Live aggregate counts for the signed-out splash teaser, from the PUBLIC /summary endpoint.
export type TaxonomySummary = {
  skills: number;
  jobTitles: number;
  sectors: number;
};

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function getJson<T>(path: string): Promise<T> {
  return authedFetchJson<T>(`${BASE}${path}`);
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

  /**
   * GET /api/skills-taxonomy/summary (PUBLIC — no auth required)
   * Live aggregate counts of active sectors / job titles / skills for the signed-out
   * splash teaser. Works without a session token (the endpoint has no auth gate).
   */
  getSummary: () => getJson<TaxonomySummary>('/summary'),
};
