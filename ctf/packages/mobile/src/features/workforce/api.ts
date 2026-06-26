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
