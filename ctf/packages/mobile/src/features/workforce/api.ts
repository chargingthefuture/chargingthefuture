import { Platform } from 'react-native';

export const WORKFORCE_API_BASE = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000/api/workforce'
  : 'http://localhost:3000/api/workforce';

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
  const res = await fetch(`${WORKFORCE_API_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch workforce dashboard');
  const json = await res.json() as { dashboard: WorkforceDashboardData };
  return json.dashboard;
}

export async function fetchWorkforceProfile(): Promise<WorkforceProfileData | null> {
  const res = await fetch(`${WORKFORCE_API_BASE}/profile`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch workforce profile');
  const json = await res.json() as { profile: WorkforceProfileData };
  return json.profile;
}
