// Workforce mobile API client. Mirrors the web routes under
// ctf/packages/web/app/api/workforce/*. All calls go through authedFetch so the
// Clerk bearer token is attached and the base URL comes from runtime config (APP_URL).
import { authedFetch } from '../../auth/authedFetch';

const WORKFORCE_BASE = '/api/workforce';

export interface WorkforceDashboardData {
  workforceTotal: number;
  recruitedTotal: number;
  occupationsTotal: number;
  activeAnnouncementsTotal: number;
  generatedAtIso: string;
}

export interface WorkforceProfileData {
  userId: string;
  occupationId: string | null;
  occupationName: string | null;
  skillLevel: string;
  region: string | null;
  recruitedState: boolean;
  recruitedResolvedAtIso: string | null;
  updatedAtIso: string;
}

export async function fetchWorkforceDashboard(): Promise<WorkforceDashboardData> {
  const res = await authedFetch(`${WORKFORCE_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch workforce dashboard');
  const json = await res.json() as { dashboard: WorkforceDashboardData };
  return json.dashboard;
}

export async function fetchWorkforceProfile(): Promise<WorkforceProfileData | null> {
  const res = await authedFetch(`${WORKFORCE_BASE}/profile`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch workforce profile');
  const json = await res.json() as { profile: WorkforceProfileData };
  return json.profile;
}
