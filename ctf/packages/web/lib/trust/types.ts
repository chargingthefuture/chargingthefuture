// Trust plugin types for web app

export type TrustStatus = 'unverified' | 'verified' | 'flagged';
export type TrustVisibility = 'public' | 'private' | 'restricted';

export const TRUST_VISIBILITY_VALUES: readonly TrustVisibility[] = ['public', 'private', 'restricted'];

// Admin-settable trust statuses (the snapshot route never changes status; only an admin can).
export const TRUST_ADMIN_STATUS_VALUES: readonly TrustStatus[] = ['verified', 'flagged'];

// The coarse, derived metrics computed for one snapshot. Real-data-only: every count comes from
// actual rows in the upstream plugins' tables. No numeric trust score is ever produced — these are
// raw counts used to build qualitative evidence, then persisted for audit/freshness.
export interface TrustSignalMetrics {
  // Distinct calendar days the member logged in (from login_events).
  loginDays: number;
  // Total recorded login events (from login_events).
  loginEvents: number;
  // Most recent login timestamp, if any (ISO string).
  lastLoginAt: string | null;
  // Completed SocketRelay trades: closed fulfillments where the member was requester or fulfiller.
  socketRelayCompletedTrades: number;
  // Distinct SocketRelay requests the member opened (any status).
  socketRelayRequestsOpened: number;
}

export interface TrustEvidenceItem {
  type: string; // e.g. 'admin-note', 'user-submission', 'external-link'
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

export interface TrustSignalSnapshot {
  id: string;
  userId: string;
  snapshot: Record<string, unknown>;
  snapshotType: string;
  createdAt: string;
}

export interface TrustAdminAuditTrail {
  id: string;
  actorUserId?: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetUserId?: string;
  requestId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
