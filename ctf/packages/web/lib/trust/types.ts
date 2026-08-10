// Trust plugin types for web app

export type TrustStatus = 'unverified' | 'verified' | 'flagged';
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
  // Distinct members who paid this member via a completed ServiceCredits transfer (from
  // service_credits_transfers). Breadth signal: other people chose to transact with them. Distinct
  // senders (not total) so one repeat payer can't inflate it.
  serviceCreditsDistinctPayers: number;
  // Completed ServiceCredits transfers this member received (from service_credits_transfers).
  serviceCreditsCompletedReceived: number;
  // Disputes opened against this member's received transfers (from service_credits_disputes). Used
  // only to withhold the clean-record signal — never surfaced as a negative badge or a deduction.
  serviceCreditsDisputesAgainst: number;
  // Per-plugin participation counts (coarse COUNTs of completed/accepted/claimed real rows). Each is a
  // categorical "did they take part" signal so a member active in only one plugin is still seen. Privacy:
  // sensitive personal-wellbeing/verification plugins (ClickLog, Mood, Unlock) are excluded
  // by design — their activity is covered by login without exposing what a member is going through.
  lighthouseMatchesAccepted: number;
  trustTransportTripsCompleted: number;
  skillsHuntSubmissionsAccepted: number;
  levelUpCohortsCompleted: number;
  chymeRoomsJoined: number;
  directoryProfilesClaimed: number;
  whatWorksEndorsements: number;
  peerProgrammingCohortsJoined: number;
  contributionsConfirmed: number;
  // Foundation connection threads where this member is the provider — survivors chose to connect with
  // them. Provider-side only (clean social proof); the seeker side is never surfaced (help-seeking is
  // sensitive). Counts threads (one per survivor↔provider pair), so it reads as "connected with N members".
  foundationConnectionsAsProvider: number;
  // Distinct OTHER members with whom this member has a CONFIRMED (active) recurring activity, either
  // side (from recurring_activities). Distinct counterparties — not raw activity count — so a single
  // repeated partner or a collusion ring confirming each other cannot inflate the signal. Never a
  // money amount and never the counterparty's identity; only the coarse breadth count.
  recurringActivityCounterparties: number;
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
  updatedAt: string;
}

// How much of a member's trust panel the viewer is being shown.
//   full    — every derived evidence item, with its timestamp and supporting detail. The owner and
//             an admin get this.
//   summary — headline counts only: no timestamps, no supporting detail, and the per-plugin items
//             collapsed to a single breadth line. What every other member gets.
export type TrustDisclosure = 'full' | 'summary';

// One evidence line as a viewer other than the owner sees it. `createdAt` and `details` are optional
// here because the summary disclosure deliberately carries neither — a peer learns the coarse fact,
// never the record of when it happened.
export interface TrustPeerEvidenceItem {
  type: string;
  summary: string;
  details?: string;
  createdAt?: string;
}

// The payload `GET /api/trust/user/[userId]` returns. Same shape at both disclosure levels so the
// widget renders one way; `trustDisclosure` tells the viewer which one they are looking at.
export interface TrustPeerView {
  userId: string;
  trustStatus: TrustStatus;
  trustEvidence: TrustPeerEvidenceItem[];
  updatedAt: string;
  trustDisclosure: TrustDisclosure;
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
