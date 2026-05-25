import type { UnlockAccessTier } from 'lib/unlock/types';
import { resolveRequestIdentity } from './request-identity';
import { pluginAuthDeny, type PluginDenyResponse } from './deny-taxonomy';

export type AllowDecision = {
  allowed: true;
  userId: string;
  username: string | null;
  role: string | null;
  isAdmin: boolean;
  isApproved: boolean;
  unlockAccessTier: UnlockAccessTier | null;
};

export type PluginAuthDecision = AllowDecision | PluginDenyResponse;

type EvaluatePluginAccessOptions = {
  requiredRoles?: string[];
  requireUsername?: boolean;
  requireApprovedUserOrAdmin?: boolean;
  allowUnlockSupportOnly?: boolean;
};

function buildAllowDecision(
  userId: string,
  username: string | null,
  role: string | null,
  isApproved: boolean,
  unlockAccessTier: UnlockAccessTier | null,
): AllowDecision {
  return {
    allowed: true,
    userId,
    username,
    role,
    isAdmin: role === 'admin',
    isApproved,
    unlockAccessTier,
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

  if (
    !allowUnlockSupportOnly
    && identity.unlockAccessTier === 'locked_support_only'
    && identity.role !== 'admin'
  ) {
    return pluginAuthDeny.forbiddenPolicy('unlock_support_only');
  }

  if (requireApprovedUserOrAdmin && identity.role !== 'admin' && !identity.isApproved) {
    return pluginAuthDeny.forbiddenPolicy('policy_denied');
  }

  return buildAllowDecision(
    identity.userId,
    identity.username,
    identity.role,
    identity.isApproved,
    identity.unlockAccessTier,
  );
}
