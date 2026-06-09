export type PluginDenyCode =
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_FORBIDDEN_ROLE'
  | 'AUTH_FORBIDDEN_POLICY';

export type PluginDenyReason =
  | 'no_active_session'
  | 'missing_required_role'
  | 'policy_denied'
  | 'missing_username'
  | 'unlock_required';

export type PluginDenyResponse = {
  allowed: false;
  status: 401 | 403;
  code: PluginDenyCode;
  reason: PluginDenyReason;
  requiredRoles?: string[];
};

export const pluginAuthDeny = {
  unauthorized(): PluginDenyResponse {
    return {
      allowed: false,
      status: 401,
      code: 'AUTH_UNAUTHORIZED',
      reason: 'no_active_session',
    };
  },
  forbiddenRole(requiredRoles: string[]): PluginDenyResponse {
    return {
      allowed: false,
      status: 403,
      code: 'AUTH_FORBIDDEN_ROLE',
      reason: 'missing_required_role',
      requiredRoles,
    };
  },
  forbiddenPolicy(reason: PluginDenyReason = 'policy_denied'): PluginDenyResponse {
    return {
      allowed: false,
      status: 403,
      code: 'AUTH_FORBIDDEN_POLICY',
      reason,
    };
  },
} as const;
