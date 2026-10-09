// The signed-in member's own Trust signals, from GET /api/trust/user/self — the route the web's
// account hub reads through the same server function. Types copied from the web's lib/trust/types.ts.

import { authedFetch } from '../../../auth/authedFetch';

export interface TrustPeerEvidenceItem {
  type: string;
  summary: string;
  details?: string;
  createdAt?: string;
}

export interface TrustSelf {
  userId: string;
  trustEvidence: TrustPeerEvidenceItem[];
  updatedAt: string;
}

export async function fetchOwnTrust(): Promise<TrustSelf> {
  const res = await authedFetch('/api/trust/user/self');
  if (!res.ok) {
    throw new Error(`trust_self_fetch_failed:${res.status}`);
  }
  return res.json() as Promise<TrustSelf>;
}
