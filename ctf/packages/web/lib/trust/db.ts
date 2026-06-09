import { queryDb } from 'lib/db/postgres';
import { TRUST_SNAPSHOT_MODEL } from './constants';
import type {
  TrustEvidenceItem,
  TrustSignalMetrics,
  TrustSignalSnapshot,
  TrustStatus,
  TrustUserExtension,
  TrustVisibility,
} from './types';

export async function getTrustUserExtension(userId: string): Promise<TrustUserExtension> {
  const result = await queryDb<{
    user_id: string;
    trust_status: string;
    trust_evidence: TrustEvidenceItem[];
    trust_visibility: string;
    updated_at: Date;
  }>(
    `SELECT user_id, trust_status, trust_evidence, trust_visibility, updated_at FROM trust_user_extension WHERE user_id = $1`,
    [userId]
  );
  if (!result.rows.length) {
    return {
      userId,
      trustStatus: 'unverified',
      trustEvidence: [],
      trustVisibility: 'public',
      updatedAt: new Date().toISOString(),
    };
  }
  const row = result.rows[0];
  return {
    userId: row.user_id,
    trustStatus: row.trust_status as TrustUserExtension['trustStatus'],
    trustEvidence: row.trust_evidence ?? [],
    trustVisibility: row.trust_visibility as TrustUserExtension['trustVisibility'],
    updatedAt: row.updated_at.toISOString(),
  };
}

// === Cross-plugin signal aggregation (real-data-only) =========================================
//
// Trust owns no participation data. It derives a qualitative signal by counting ACTUAL rows in the
// already-seeded upstream plugins. Every query below is a plain COUNT/aggregate over real tables;
// nothing is fabricated, and a member with no upstream rows simply yields zeroes (and therefore no
// evidence — see buildTrustEvidence).
//
// Signals used in the `cross_plugin_engagement_v1` model:
//   - login_events            → how often / how recently the member logs in
//   - socketrelay_fulfillments→ completed (closed) SocketRelay trades the member took part in
//   - socketrelay_requests    → how many SocketRelay asks the member opened
export async function computeTrustSignalMetrics(userId: string): Promise<TrustSignalMetrics> {
  const [loginAgg, completedTrades, requestsOpened] = await Promise.all([
    queryDb<{ login_days: string; login_events: string; last_login_at: Date | null }>(
      `SELECT
         COUNT(DISTINCT date_trunc('day', created_at)) AS login_days,
         COUNT(*) AS login_events,
         MAX(created_at) AS last_login_at
       FROM login_events
       WHERE user_id = $1`,
      [userId]
    ),
    // A "completed trade" is a closed fulfillment in which the member was either the requester or
    // the fulfiller. Closing a fulfillment is how a SocketRelay trade is finished (see
    // socketrelay.repository.closeFulfillment), so a closed row is a genuinely completed exchange.
    queryDb<{ completed: string }>(
      `SELECT COUNT(*) AS completed
       FROM socketrelay_fulfillments
       WHERE status = 'closed'
         AND (requester_user_id = $1 OR fulfiller_user_id = $1)`,
      [userId]
    ),
    queryDb<{ opened: string }>(
      `SELECT COUNT(*) AS opened
       FROM socketrelay_requests
       WHERE owner_user_id = $1`,
      [userId]
    ),
  ]);

  const loginRow = loginAgg.rows[0];
  return {
    loginDays: Number(loginRow?.login_days ?? 0),
    loginEvents: Number(loginRow?.login_events ?? 0),
    lastLoginAt: loginRow?.last_login_at ? loginRow.last_login_at.toISOString() : null,
    socketRelayCompletedTrades: Number(completedTrades.rows[0]?.completed ?? 0),
    socketRelayRequestsOpened: Number(requestsOpened.rows[0]?.opened ?? 0),
  };
}

// Build human-readable, NON-NUMERIC-SCORE evidence from the real metric counts. Real-data-only:
// any signal whose backing rows are absent (count of 0 / no login) produces NO evidence item, so
// the panel never claims activity that did not happen.
export function buildTrustEvidence(metrics: TrustSignalMetrics, nowIso: string): TrustEvidenceItem[] {
  const evidence: TrustEvidenceItem[] = [];

  if (metrics.socketRelayCompletedTrades > 0) {
    const n = metrics.socketRelayCompletedTrades;
    evidence.push({
      type: 'engagement-socketrelay-trades',
      summary: `Completed ${n} SocketRelay ${n === 1 ? 'trade' : 'trades'}`,
      createdAt: nowIso,
      createdBy: 'trust-signal',
    });
  }

  if (metrics.socketRelayRequestsOpened > 0) {
    const n = metrics.socketRelayRequestsOpened;
    evidence.push({
      type: 'engagement-socketrelay-requests',
      summary: `Opened ${n} SocketRelay ${n === 1 ? 'request' : 'requests'}`,
      createdAt: nowIso,
      createdBy: 'trust-signal',
    });
  }

  if (metrics.loginDays > 0) {
    const n = metrics.loginDays;
    evidence.push({
      type: 'engagement-login-frequency',
      summary: `Active on ${n} ${n === 1 ? 'day' : 'days'}`,
      details: metrics.lastLoginAt ? `Most recent sign-in ${metrics.lastLoginAt}` : undefined,
      createdAt: nowIso,
      createdBy: 'trust-signal',
    });
  }

  return evidence;
}

// Persist one computed snapshot row (append-only) capturing the derived metrics for audit/freshness.
export async function insertTrustSignalSnapshot(
  userId: string,
  metrics: TrustSignalMetrics,
): Promise<TrustSignalSnapshot> {
  const result = await queryDb<{
    id: string;
    user_id: string;
    snapshot: Record<string, unknown>;
    snapshot_type: string;
    created_at: Date;
  }>(
    `INSERT INTO trust_signal_snapshot (user_id, snapshot, snapshot_type)
     VALUES ($1, $2::jsonb, $3)
     RETURNING id, user_id, snapshot, snapshot_type, created_at`,
    [userId, JSON.stringify(metrics), TRUST_SNAPSHOT_MODEL]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    snapshot: row.snapshot,
    snapshotType: row.snapshot_type,
    createdAt: row.created_at.toISOString(),
  };
}

// Replace the user's derived evidence with the freshly computed items and bump updated_at. This
// does NOT touch trust_status (admin-controlled) or trust_visibility (user-controlled). Upserts the
// extension row so a first-time member gets defaults.
export async function setTrustDerivedEvidence(
  userId: string,
  evidence: TrustEvidenceItem[],
): Promise<TrustUserExtension> {
  const result = await queryDb<{
    user_id: string;
    trust_status: string;
    trust_evidence: TrustEvidenceItem[];
    trust_visibility: string;
    updated_at: Date;
  }>(
    `INSERT INTO trust_user_extension (user_id, trust_evidence, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET trust_evidence = EXCLUDED.trust_evidence, updated_at = NOW()
     RETURNING user_id, trust_status, trust_evidence, trust_visibility, updated_at`,
    [userId, JSON.stringify(evidence)]
  );
  const row = result.rows[0];
  return {
    userId: row.user_id,
    trustStatus: row.trust_status as TrustStatus,
    trustEvidence: row.trust_evidence ?? [],
    trustVisibility: row.trust_visibility as TrustVisibility,
    updatedAt: row.updated_at.toISOString(),
  };
}

// Update only the caller's visibility setting. Upserts so a first-time member's row is created.
export async function updateTrustVisibility(
  userId: string,
  visibility: TrustVisibility,
): Promise<TrustUserExtension> {
  const result = await queryDb<{
    user_id: string;
    trust_status: string;
    trust_evidence: TrustEvidenceItem[];
    trust_visibility: string;
    updated_at: Date;
  }>(
    `INSERT INTO trust_user_extension (user_id, trust_visibility, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET trust_visibility = EXCLUDED.trust_visibility, updated_at = NOW()
     RETURNING user_id, trust_status, trust_evidence, trust_visibility, updated_at`,
    [userId, visibility]
  );
  const row = result.rows[0];
  return {
    userId: row.user_id,
    trustStatus: row.trust_status as TrustStatus,
    trustEvidence: row.trust_evidence ?? [],
    trustVisibility: row.trust_visibility as TrustVisibility,
    updatedAt: row.updated_at.toISOString(),
  };
}

// Admin sets a target user's trust status (verified | flagged) and appends one admin evidence item.
// The append is done in SQL so concurrent admin edits don't clobber each other's evidence.
export async function applyAdminVerification(
  targetUserId: string,
  status: TrustStatus,
  adminEvidence: TrustEvidenceItem,
): Promise<TrustUserExtension> {
  const result = await queryDb<{
    user_id: string;
    trust_status: string;
    trust_evidence: TrustEvidenceItem[];
    trust_visibility: string;
    updated_at: Date;
  }>(
    `INSERT INTO trust_user_extension (user_id, trust_status, trust_evidence, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET trust_status = EXCLUDED.trust_status,
           trust_evidence = COALESCE(trust_user_extension.trust_evidence, '[]'::jsonb) || $3::jsonb,
           updated_at = NOW()
     RETURNING user_id, trust_status, trust_evidence, trust_visibility, updated_at`,
    [targetUserId, status, JSON.stringify([adminEvidence])]
  );
  const row = result.rows[0];
  return {
    userId: row.user_id,
    trustStatus: row.trust_status as TrustStatus,
    trustEvidence: row.trust_evidence ?? [],
    trustVisibility: row.trust_visibility as TrustVisibility,
    updatedAt: row.updated_at.toISOString(),
  };
}
