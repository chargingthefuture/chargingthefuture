import type { AllowDecision } from 'lib/auth/server-authz';
import { pluginAuthDeny, type PluginDenyResponse } from 'lib/auth/deny-taxonomy';

// The access-policy contract lists requiredRoles [admin, operations] for every
// weekly-performance command, including the admin-gated week-selection surface.
// Admins always pass; operations-role users are permitted too.
export function ensureWeeklyPerformanceAdmin(auth: AllowDecision): PluginDenyResponse | null {
  if (auth.isAdmin || auth.role === 'operations') {
    return null;
  }

  return pluginAuthDeny.forbiddenRole(['admin', 'operations']);
}
