// Workforce mobile API client. Mirrors the web routes under
// ctf/packages/web/app/api/workforce/*. All calls go through authedFetch so the
// Clerk bearer token is attached and the base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

const WORKFORCE_BASE = '/api/workforce';

export interface WorkforceDashboardData {
  population: number;
  participationRate: number;
  workforceTotal: number;
  totalHeadcountTarget: number;
  totalMembers: number;
  recruitedTotal: number;
  percentRecruited: number;
  remainingCapacity: number;
  minRecruitable: number;
  maxRecruitable: number;
  sectorsTotal: number;
  occupationsTotal: number;
  generatedAtIso: string;
}

export interface WorkforceGroupedReportItem {
  bucket: string;
  target: number;
  members: number;
  recruited: number;
  gap: number;
}

export interface WorkforceOccupationGapItem {
  jobTitleId: string;
  occupation: string;
  sector: string;
  skillLevel: string;
  target: number;
  members: number;
  recruited: number;
  gap: number;
}

// GET /api/workforce/profile returns the same full profile object to web and mobile, so this type
// mirrors the web WorkforceProfile shape (including the extension fields) even though the mobile
// profile card does not render the extension fields today — keeping the types aligned avoids silent
// drift between the two clients.
export interface WorkforceProfileData {
  userId: string;
  occupationId: string | null;
  occupationName: string | null;
  skillLevel: string;
  region: string | null;
  recruitedState: boolean;
  recruitedResolvedAtIso: string | null;
  availabilityPreferences: Record<string, unknown>;
  workPreferences: Record<string, unknown>;
  serviceDeletedAtIso: string | null;
  updatedAtIso: string;
}

export async function fetchWorkforceDashboard(): Promise<WorkforceDashboardData> {
  const res = await authedFetch(`${WORKFORCE_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch workforce dashboard');
  const json = await res.json() as { dashboard: WorkforceDashboardData };
  return json.dashboard;
}

export async function fetchWorkforceSectorReport(): Promise<WorkforceGroupedReportItem[]> {
  const res = await authedFetch(`${WORKFORCE_BASE}/reports/sector/all`);
  if (!res.ok) throw new Error('Failed to fetch workforce sector report');
  const json = await res.json() as { items?: WorkforceGroupedReportItem[] };
  return json.items ?? [];
}

export async function fetchWorkforceOccupationGaps(limit = 10): Promise<WorkforceOccupationGapItem[]> {
  const res = await authedFetch(`${WORKFORCE_BASE}/reports/occupations?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch workforce occupation gaps');
  const json = await res.json() as { items?: WorkforceOccupationGapItem[] };
  return json.items ?? [];
}

export async function fetchWorkforceProfile(): Promise<WorkforceProfileData | null> {
  const res = await authedFetch(`${WORKFORCE_BASE}/profile`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch workforce profile');
  const json = await res.json() as { profile: WorkforceProfileData };
  return json.profile;
}

// An occupation (Skills Taxonomy job title) with its demand/supply overlay. Mirrors the web
// WorkforceOccupation type, including the derived annualTrainingTarget.
export interface WorkforceOccupation {
  id: string;
  name: string;
  sector: string;
  skillLevel: string;
  target: number;
  annualTrainingTarget: number;
  members: number;
  recruited: number;
  gap: number;
}

// Why a member counts toward a bucket; and the matched-member shape for the sector / skill-level
// drilldowns. Mirrors the web WorkforceMatchReason / WorkforceMatchedMember / WorkforceBucketDetail.
export type WorkforceMatchReason = 'sector' | 'jobTitle' | 'skill' | 'none';

export interface WorkforceMatchedMember {
  profileId: string;
  displayName: string;
  skills: string[];
  sectors: string[];
  jobTitles: string[];
  // Per-occupation match detail (mirrors web): the reason THIS occupation matched, the member's
  // skills that produced it (skill matches only), and the occupation's remaining demand gap.
  matchingOccupations: Array<{
    id: string;
    title: string;
    sector: string;
    reason: WorkforceMatchReason;
    viaSkills: string[];
    gap: number;
  }>;
  matchReason: WorkforceMatchReason;
}

export interface WorkforceBucketDetail {
  bucket: string;
  target: number;
  members: number;
  recruited: number;
  gap: number;
  matchedMembers: WorkforceMatchedMember[];
}

const OCCUPATIONS_PAGE_SIZE = 100; // API max; page through to load the full list for client filtering.

// Load every occupation by paging through the list endpoint (the API caps page size at 100 and has no
// server-side sector/skill filters, so the browse screen filters client-side — same as web).
export async function fetchAllWorkforceOccupations(): Promise<WorkforceOccupation[]> {
  const first = await authedFetch(`${WORKFORCE_BASE}/occupations?page=1&pageSize=${OCCUPATIONS_PAGE_SIZE}`);
  if (!first.ok) throw new Error('Failed to fetch occupations');
  const firstJson = await first.json() as { items?: WorkforceOccupation[]; pagination?: { total?: number } };
  const items = firstJson.items ?? [];
  const total = firstJson.pagination?.total ?? items.length;
  const pages = Math.ceil(total / OCCUPATIONS_PAGE_SIZE);
  if (pages <= 1) return items;
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      authedFetch(`${WORKFORCE_BASE}/occupations?page=${i + 2}&pageSize=${OCCUPATIONS_PAGE_SIZE}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: WorkforceOccupation[] }) => j.items ?? []),
    ),
  );
  return items.concat(...rest);
}

export async function fetchWorkforceOccupation(id: string): Promise<WorkforceOccupation | null> {
  const res = await authedFetch(`${WORKFORCE_BASE}/occupations/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch occupation');
  const json = await res.json() as { occupation: WorkforceOccupation };
  return json.occupation;
}

export async function fetchWorkforceSkillLevelReport(): Promise<WorkforceGroupedReportItem[]> {
  const res = await authedFetch(`${WORKFORCE_BASE}/reports/skill-level/all`);
  if (!res.ok) throw new Error('Failed to fetch workforce skill-level report');
  const json = await res.json() as { items?: WorkforceGroupedReportItem[] };
  return json.items ?? [];
}

export async function fetchWorkforceSectorDetail(sector: string): Promise<WorkforceBucketDetail | null> {
  const res = await authedFetch(`${WORKFORCE_BASE}/reports/sector/${encodeURIComponent(sector)}`);
  if (!res.ok) throw new Error('Failed to fetch sector detail');
  const json = await res.json() as { detail?: WorkforceBucketDetail | null };
  return json.detail ?? null;
}

export async function fetchWorkforceSkillLevelDetail(skillLevel: string): Promise<WorkforceBucketDetail | null> {
  const res = await authedFetch(`${WORKFORCE_BASE}/reports/skill-level/${encodeURIComponent(skillLevel)}`);
  if (!res.ok) throw new Error('Failed to fetch skill-level detail');
  const json = await res.json() as { detail?: WorkforceBucketDetail | null };
  return json.detail ?? null;
}
