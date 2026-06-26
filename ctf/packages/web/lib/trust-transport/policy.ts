import type { AllowDecision } from 'lib/auth/server-authz';
import { pluginAuthDeny, type PluginDenyResponse } from 'lib/auth/deny-taxonomy';

export function ensureTrustTransportAdmin(decision: AllowDecision): PluginDenyResponse | null {
  if (decision.isAdmin || decision.role === 'operations') {
    return null;
  }

  return pluginAuthDeny.forbiddenRole(['admin', 'operations']);
}

export function ensureTrustTransportProviderRole(decision: AllowDecision): PluginDenyResponse | null {
  if (decision.isAdmin || decision.role === 'provider') {
    return null;
  }

  return pluginAuthDeny.forbiddenRole(['provider']);
}
