import { resolveRequestIdentity } from './request-identity';
import { pluginAuthDeny, type PluginDenyResponse } from './deny-taxonomy';
import { isUserUnlocked } from 'lib/unlock/access';

export type AllowDecision = {
  allowed: true;
  userId: string;
  username: string | null;
  role: string | null;
  isAdmin: boolean;
  isApproved: boolean;
};

export type PluginAuthDecision = AllowDecision | PluginDenyResponse;

type EvaluatePluginAccessOptions = {
  requiredRoles?: string[];
  requireUsername?: boolean;
  requireApprovedUserOrAdmin?: boolean;
  // When true, users who have not yet been unlocked (pending / rejected) can still
  // reach the route (e.g. unlock submission, chyme, hub, account endpoints).
  allowUnlockSupportOnly?: boolean;
};

function buildAllowDecision(
  userId: string,
  username: string | null,
  role: string | null,
  isApproved: boolean,
): AllowDecision {
  return {
    allowed: true,
    userId,
    username,
    role,
    isAdmin: role === 'admin',
    isApproved,
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
    requireApprovedUserOrAdmin = false,
    allowUnlockSupportOnly = false,
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

  // Unlock access gate: check flag + DB rather than cookie/header tier.
  // Admins bypass this check entirely; routes that allow unapproved users (e.g. unlock
  // submission, chyme, hub) pass allowUnlockSupportOnly: true to opt out.
  if (!allowUnlockSupportOnly && identity.role !== 'admin') {
    const unlocked = await isUserUnlocked(identity.userId);
    if (!unlocked) {
      return pluginAuthDeny.forbiddenPolicy('unlock_support_only');
    }
  }

  if (requireApprovedUserOrAdmin && identity.role !== 'admin' && !identity.isApproved) {
    return pluginAuthDeny.forbiddenPolicy('policy_denied');
  }

  return buildAllowDecision(
    identity.userId,
    identity.username,
    identity.role,
    identity.isApproved,
  );
}
