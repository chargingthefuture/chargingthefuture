import { resolveRequestIdentity } from './request-identity';
import { pluginAuthDeny, type PluginDenyResponse } from './deny-taxonomy';
import { getUnlockAccessTier } from 'lib/unlock/access';

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
  return {
    allowed: true,
    userId,
    username,
    role,
    isAdmin: role === 'admin',
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

export async function evaluatePluginAccess(
  options: EvaluatePluginAccessOptions = {},
): Promise<PluginAuthDecision> {
  const {
    requiredRoles,
    requireUsername = false,
    minUnlockTier = 'approved_full',
  } = options;

  const identity = await resolveRequestIdentity();
  const normalizedRequiredRoles = normalizeRequiredRoles(requiredRoles);

  if (!identity.isAuthenticated || !identity.userId) {
    return pluginAuthDeny.unauthorized();
  }

  if (requireUsername && !identity.username) {
    return pluginAuthDeny.forbiddenPolicy('missing_username');
  }

  if (normalizedRequiredRoles.length > 0) {
    const role = identity.role?.toLowerCase();
    if (!role || !normalizedRequiredRoles.includes(role)) {
      return pluginAuthDeny.forbiddenRole(requiredRoles ?? []);
    }
  }

  // Unlock access gate — the single source of truth for full app access. Admins always
  // pass. 'any_authenticated' routes (unlock submission/status, account/profile/deletion)
  // skip the tier check so a gated user can always submit and manage their own data.
  if (identity.role !== 'admin' && minUnlockTier !== 'any_authenticated') {
    const tier = await getUnlockAccessTier(identity.userId);
    const allowed =
      minUnlockTier === 'support_only'
        ? tier === 'approved_full' || tier === 'locked_support_only'
        : tier === 'approved_full';
    if (!allowed) {
      return pluginAuthDeny.forbiddenPolicy('unlock_required');
    }
  }

  return buildAllowDecision(identity.userId, identity.username, identity.role);
}
