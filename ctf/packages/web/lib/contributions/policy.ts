import type { AllowDecision } from 'lib/auth/server-authz';
import { pluginAuthDeny, type PluginDenyResponse } from 'lib/auth/deny-taxonomy';

export function ensureContributionsAdmin(auth: AllowDecision): PluginDenyResponse | null {
  if (auth.isAdmin) {
    return null;
  }

  return pluginAuthDeny.forbiddenRole(['admin']);
}
