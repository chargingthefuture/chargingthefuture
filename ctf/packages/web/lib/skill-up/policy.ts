import type { AllowDecision } from 'lib/auth/server-authz';
import { pluginAuthDeny, type PluginDenyResponse } from 'lib/auth/deny-taxonomy';

export function ensureSkillUpAdmin(auth: AllowDecision): PluginDenyResponse | null {
  if (auth.isAdmin) {
    return null;
  }

  return pluginAuthDeny.forbiddenRole(['admin']);
}

export function ensureSkillUpTrainerOrAdmin(input: { auth: AllowDecision; isTrainerForScope: boolean }): PluginDenyResponse | null {
  if (input.auth.isAdmin || input.isTrainerForScope) {
    return null;
  }

  return pluginAuthDeny.forbiddenRole(['admin', 'trainer']);
}
