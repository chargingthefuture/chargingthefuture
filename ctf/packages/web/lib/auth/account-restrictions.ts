import { queryDb } from 'lib/db/postgres';

// Platform-wide account-restriction signal. One canonical record (account_restrictions) supersedes the
// per-plugin flags (TrustTransport account_restricted, ServiceCredits wallet is_frozen). A restriction
// carries a scope: 'all' (full account block, enforced in the auth gate), 'trading' (value movement —
// ServiceCredits transfers, TrustTransport requests), or 'contact' (initiating matches/connections).
// A restriction with scope S blocks an attempted action of scope A iff S === 'all' OR S === A.

export type RestrictionScope = 'all' | 'trading' | 'contact';

export const RESTRICTION_SCOPES: readonly RestrictionScope[] = ['all', 'trading', 'contact'];

export type AccountRestrictionStatus = {
  isRestricted: boolean;
  scope?: RestrictionScope;
  restrictedAt?: string | null;
  reason?: string | null;
};

type RestrictionRow = {
  is_restricted: boolean;
  restriction_scope: RestrictionScope;
  restricted_at: Date | null;
  restriction_reason: string | null;
};

// Is the member restricted for the given action scope? Returns not-restricted when no row exists, the
// row is cleared, or the stored scope does not cover the attempted action.
export async function getAccountRestrictionStatus(
  userId: string,
  actionScope: RestrictionScope,
): Promise<AccountRestrictionStatus> {
  const result = await queryDb<RestrictionRow>(
    `SELECT is_restricted, restriction_scope, restricted_at, restriction_reason
     FROM account_restrictions
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row || !row.is_restricted) {
    return { isRestricted: false };
  }

  const covers = row.restriction_scope === 'all' || row.restriction_scope === actionScope;
  if (!covers) {
    return { isRestricted: false };
  }

  return {
    isRestricted: true,
    scope: row.restriction_scope,
    restrictedAt: row.restricted_at ? row.restricted_at.toISOString() : null,
    reason: row.restriction_reason,
  };
}

async function insertAccountRestrictionAudit(
  actorId: string,
  action: 'restrict' | 'unrestrict',
  targetUserId: string,
  scope: RestrictionScope | null,
  reason: string | null,
): Promise<void> {
  await queryDb(
    `INSERT INTO account_restrictions_audit (actor_id, action, target_user_id, scope, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, action, targetUserId, scope, reason],
  );
}

// Restrict a member at the given scope (default 'all'). Idempotent upsert; writes an audit row.
export async function restrictAccount(input: {
  targetUserId: string;
  actorId: string;
  reason?: string | null;
  scope?: RestrictionScope;
}): Promise<{ targetUserId: string; restricted: true; scope: RestrictionScope }> {
  const scope: RestrictionScope = input.scope ?? 'all';
  const reason = input.reason ?? null;

  await queryDb(
    `INSERT INTO account_restrictions
       (user_id, is_restricted, restriction_scope, restricted_at, restricted_by_user_id, restriction_reason, updated_at)
     VALUES ($1, TRUE, $2, NOW(), $3, $4, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET is_restricted = TRUE, restriction_scope = EXCLUDED.restriction_scope,
       restricted_at = NOW(), restricted_by_user_id = EXCLUDED.restricted_by_user_id,
       restriction_reason = EXCLUDED.restriction_reason, updated_at = NOW()`,
    [input.targetUserId, scope, input.actorId, reason],
  );

  await insertAccountRestrictionAudit(input.actorId, 'restrict', input.targetUserId, scope, reason);
  return { targetUserId: input.targetUserId, restricted: true, scope };
}

// Lift a member's restriction. Writes an audit row.
export async function unrestrictAccount(input: {
  targetUserId: string;
  actorId: string;
}): Promise<{ targetUserId: string; restricted: false }> {
  await queryDb(
    `UPDATE account_restrictions SET is_restricted = FALSE, updated_at = NOW() WHERE user_id = $1`,
    [input.targetUserId],
  );

  await insertAccountRestrictionAudit(input.actorId, 'unrestrict', input.targetUserId, null, null);
  return { targetUserId: input.targetUserId, restricted: false };
}

export type AccountRestrictionAuditEntry = {
  id: string;
  actorId: string;
  action: 'restrict' | 'unrestrict';
  targetUserId: string;
  scope: string | null;
  reason: string | null;
  createdAt: string;
};

export async function listAccountRestrictionAudit(limit = 100): Promise<AccountRestrictionAuditEntry[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 500 ? Math.floor(limit) : 100;
  const result = await queryDb<{
    id: string;
    actor_id: string;
    action: 'restrict' | 'unrestrict';
    target_user_id: string;
    scope: string | null;
    reason: string | null;
    created_at: Date;
  }>(
    `SELECT id, actor_id, action, target_user_id, scope, reason, created_at
     FROM account_restrictions_audit
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    targetUserId: row.target_user_id,
    scope: row.scope,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
  }));
}
