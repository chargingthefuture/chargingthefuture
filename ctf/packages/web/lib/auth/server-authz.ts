import { resolveRequestIdentity } from './request-identity';
import { pluginAuthDeny, type PluginDenyResponse } from './deny-taxonomy';
import { getUnlockAccessTier, isUnlockEarlyCommonsEnabled } from 'lib/unlock/access';
import { getAccountRestrictionStatus } from './account-restrictions';
import { recordLoginEvent } from 'lib/engagement/login-activity';

export type AllowDecision = {
  allowed: true;
  userId: string;
  username: string | null;
  role: string | null;
  isAdmin: boolean;
};

export type PluginAuthDecision = AllowDecision | PluginDenyResponse;

// How much Unlock access a route requires. Unlock is the single source of truth for
// full app access:
//  - 'approved_full' (default): only fully-approved users (or admins) may enter.
//  - 'support_only': approved OR support-only users may enter (e.g. the Hub general
//    channel, which is the support surface for not-yet-verified members).
//  - 'any_authenticated': any signed-in user may enter regardless of tier (e.g. the
//    Unlock submission/status routes and the account/profile/deletion routes, so a
//    gated user can always submit and can always manage or delete their own data).
type MinUnlockTier = 'approved_full' | 'support_only' | 'any_authenticated';

type EvaluatePluginAccessOptions = {
  requiredRoles?: string[];
  requireUsername?: boolean;
  minUnlockTier?: MinUnlockTier;
};

function buildAllowDecision(
  userId: string,
  username: string | null,
  role: string | null,
): AllowDecision {
  const normalizedRole = role?.trim().toLowerCase() ?? null;
  return {
    allowed: true,
    userId,
    username,
    role: normalizedRole,
    isAdmin: normalizedRole === 'admin',
  };
}

function normalizeRequiredRoles(requiredRoles: string[] | undefined): string[] {
  if (!requiredRoles || requiredRoles.length === 0) {
    return [];
  }

  return requiredRoles
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role.length > 0);
}

type RequestIdentity = Awaited<ReturnType<typeof resolveRequestIdentity>>;

// Normalize the role once so every admin/role comparison is case-insensitive, regardless of how a
// future identity source cases it.
function normalizeRoleValue(role: string | null | undefined): string | null {
  return role?.trim().toLowerCase() ?? null;
}

// Username-required and role-membership gates. Returns a deny, or null when both pass.
function resolveRoleAndUsernameDeny(
  identity: RequestIdentity,
  normalizedRole: string | null,
  requiredRoles: string[] | undefined,
  requireUsername: boolean,
): PluginDenyResponse | null {
  if (requireUsername && !identity.username) {
    return pluginAuthDeny.forbiddenPolicy('missing_username');
  }
  const normalizedRequiredRoles = normalizeRequiredRoles(requiredRoles);
  if (normalizedRequiredRoles.length > 0 && (!normalizedRole || !normalizedRequiredRoles.includes(normalizedRole))) {
    return pluginAuthDeny.forbiddenRole(requiredRoles ?? []);
  }
  return null;
}

// Unlock access gate — the single source of truth for full app access. Admins always pass;
// 'any_authenticated' routes (unlock submission/status, account/profile/deletion) skip the tier check
// so a gated user can always submit and manage their own data. Returns a deny, or null when allowed.
async function resolveUnlockTierDeny(
  userId: string,
  normalizedRole: string | null,
  minUnlockTier: MinUnlockTier,
): Promise<PluginDenyResponse | null> {
  if (normalizedRole === 'admin' || minUnlockTier === 'any_authenticated') {
    return null;
  }
  const tier = await getUnlockAccessTier(userId);
  let allowed =
    minUnlockTier === 'support_only'
      ? tier === 'approved_full' || tier === 'locked_support_only'
      : tier === 'approved_full';
  // A/B experiment: a not-yet-verified member in the "early Commons access" treatment bucket is
  // allowed into support-only surfaces (the Commons / Hub general channel) so they can ask for help
  // before completing verification. Scoped strictly to support_only — full (approved_full) plugin
  // surfaces are unaffected, and the flag defaults to false (control) so production is unchanged
  // until the rollout is enabled in Unleash.
  if (!allowed && minUnlockTier === 'support_only') {
    allowed = await isUnlockEarlyCommonsEnabled(userId);
  }
  return allowed ? null : pluginAuthDeny.forbiddenPolicy('unlock_required');
}

// Platform-wide account restriction — a full-account ('all'-scope) restriction blocks every product
// route. Skipped for admins and for 'any_authenticated' routes (account/profile/deletion, unlock
// status), so a restricted member can still see their status and manage or delete their own data.
// Narrower 'trading'/'contact' restrictions are enforced at the value-movement/contact points, not here.
async function resolveAccountRestrictionDeny(
  userId: string,
  normalizedRole: string | null,
  minUnlockTier: MinUnlockTier,
): Promise<PluginDenyResponse | null> {
  if (normalizedRole === 'admin' || minUnlockTier === 'any_authenticated') {
    return null;
  }
  const restriction = await getAccountRestrictionStatus(userId, 'all');
  return restriction.isRestricted ? pluginAuthDeny.forbiddenPolicy('account_restricted') : null;
}

export async function evaluatePluginAccess(
  options: EvaluatePluginAccessOptions = {},
): Promise<PluginAuthDecision> {
  const { requiredRoles, requireUsername = false, minUnlockTier = 'approved_full' } = options;

  const identity = await resolveRequestIdentity();
  const normalizedRole = normalizeRoleValue(identity.role);

  if (!identity.isAuthenticated || !identity.userId) {
    return pluginAuthDeny.unauthorized();
  }

  // A signed-in member reached an authorized surface — record them as active today (deduplicated to one
  // row per member per day). This populates the `login_events` table the active-member window reads,
  // which PeerProgramming cohort assignment and the Weekly Performance review both depend on. Recorded
  // before the gates so any signed-in member counts as active, and fire-and-forget so it never blocks
  // or breaks the access decision.
  recordLoginEvent(identity.userId);

  const roleDeny = resolveRoleAndUsernameDeny(identity, normalizedRole, requiredRoles, requireUsername);
  if (roleDeny) {
    return roleDeny;
  }

  const unlockDeny = await resolveUnlockTierDeny(identity.userId, normalizedRole, minUnlockTier);
  if (unlockDeny) {
    return unlockDeny;
  }

  const restrictionDeny = await resolveAccountRestrictionDeny(identity.userId, normalizedRole, minUnlockTier);
  if (restrictionDeny) {
    return restrictionDeny;
  }

  return buildAllowDecision(identity.userId, identity.username, normalizedRole);
}
