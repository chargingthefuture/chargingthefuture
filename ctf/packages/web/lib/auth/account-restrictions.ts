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

/**
 * Whether this account is restricted at all, whatever the scope, for a screen that is reporting
 * rather than gating.
 *
 * Deliberately separate from getAccountRestrictionStatus above, which answers "may this member do
 * the thing they are attempting" and so returns not-restricted when the stored scope does not cover
 * that action. An admin looking at an account needs the opposite: a member restricted from trading
 * is not blocked from writing, and is still an account somebody has already acted on.
 *
 * Never use this to gate an action. The scope is the rule for that, and it is the function above.
 */
export async function getAnyAccountRestriction(userId: string): Promise<AccountRestrictionStatus> {
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

// Apply a restriction of exactly this scope without replacing a different one. A member has a single
// account_restrictions row, so a plain restrictAccount at 'trading' would overwrite an active 'all' or
// 'contact' restriction set elsewhere and give that member back what it blocked. This writes only when
// there is no active restriction or the active one already has this scope; otherwise it changes
// nothing and reports the scope already in place. The check and the write are one statement.
export async function restrictAccountAtScope(input: {
  targetUserId: string;
  actorId: string;
  reason?: string | null;
  scope: RestrictionScope;
}): Promise<{ applied: true } | { applied: false; existingScope: RestrictionScope }> {
  const reason = input.reason ?? null;
  const written = await queryDb<{ user_id: string }>(
    `INSERT INTO account_restrictions
       (user_id, is_restricted, restriction_scope, restricted_at, restricted_by_user_id, restriction_reason, updated_at)
     VALUES ($1, TRUE, $2, NOW(), $3, $4, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET is_restricted = TRUE, restriction_scope = EXCLUDED.restriction_scope,
       restricted_at = NOW(), restricted_by_user_id = EXCLUDED.restricted_by_user_id,
       restriction_reason = EXCLUDED.restriction_reason, updated_at = NOW()
     WHERE account_restrictions.is_restricted = FALSE OR account_restrictions.restriction_scope = EXCLUDED.restriction_scope
     RETURNING user_id`,
    [input.targetUserId, input.scope, input.actorId, reason],
  );

  if (written.rows.length === 0) {
    const existing = await getAnyAccountRestriction(input.targetUserId);
    return { applied: false, existingScope: existing.scope ?? input.scope };
  }

  await insertAccountRestrictionAudit(input.actorId, 'restrict', input.targetUserId, input.scope, reason);
  return { applied: true };
}

// Lift a restriction only when the active one has exactly this scope, so a plugin's own lever (the
// ServiceCredits wallet freeze) can never lift an 'all' or 'contact' restriction set elsewhere.
// Returns lifted: false with the scope in place when a different active restriction blocks it, and
// lifted: false with no scope when there was nothing active to lift.
export async function liftAccountRestrictionAtScope(input: {
  targetUserId: string;
  actorId: string;
  scope: RestrictionScope;
}): Promise<{ lifted: true } | { lifted: false; existingScope: RestrictionScope | null }> {
  const lifted = await queryDb<{ user_id: string }>(
    `UPDATE account_restrictions SET is_restricted = FALSE, updated_at = NOW()
     WHERE user_id = $1 AND is_restricted = TRUE AND restriction_scope = $2
     RETURNING user_id`,
    [input.targetUserId, input.scope],
  );

  if (lifted.rows.length === 0) {
    const existing = await getAnyAccountRestriction(input.targetUserId);
    return { lifted: false, existingScope: existing.isRestricted ? existing.scope ?? null : null };
  }

  await insertAccountRestrictionAudit(input.actorId, 'unrestrict', input.targetUserId, input.scope, null);
  return { lifted: true };
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
