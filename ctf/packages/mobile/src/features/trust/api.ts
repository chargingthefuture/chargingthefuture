// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socket-relay/currency.
import { authedFetchJson } from '../../auth/authedFetch';

export type TrustStatus = 'unverified' | 'verified' | 'flagged';
export type TrustVisibility = 'public' | 'private' | 'restricted';

export interface TrustEvidenceItem {
  type: string;
  summary: string;
  details?: string;
  createdAt: string;
  createdBy?: string;
}

export interface TrustUserExtension {
  userId: string;
  trustStatus: TrustStatus;
  trustEvidence: TrustEvidenceItem[];
  trustVisibility: TrustVisibility;
  updatedAt: string;
}

export async function fetchTrustSelf(): Promise<TrustUserExtension> {
  return authedFetchJson<TrustUserExtension>('/api/trust/user/self');
}
