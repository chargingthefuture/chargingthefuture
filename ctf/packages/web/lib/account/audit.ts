// Audit logger for account-level deletion actions, matching the per-plugin audit shape used across
// the app (see e.g. `lib/chyme/audit.ts`): a single structured JSON line on `console.info` with a
// stable `[account.audit]` prefix. There is no shared audit sink in this codebase yet; each area
// logs its own line, so this mirrors that convention rather than inventing a new one.

import { randomUUID } from 'crypto';

export type AccountAuditEvent = {
  /** Stable command name, e.g. 'account.data.delete.service' or 'account.profile.delete.full'. */
  readonly command: string;
  /** The user whose data is being deleted (also the actor — deletion is self-service). */
  readonly actorId: string;
  readonly status: 'allow' | 'deny';
  readonly reason: string;
  /** 'service' for a single plugin, 'account' for the whole account. */
  readonly scope: 'service' | 'account';
  /** Plugin slug for service scope; omitted/undefined for account scope. */
  readonly serviceName?: string;
  readonly result: 'success' | 'failure';
  readonly errorCategory: string | null;
  /** Optional extra detail (e.g. per-table row counts). Kept free of personal data. */
  readonly metadata?: Record<string, unknown>;
};

export function logAccountAudit(event: AccountAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'account',
    command: event.command,
    commandVersion: '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      scope: event.scope,
      ...(event.serviceName ? { serviceName: event.serviceName } : {}),
    },
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[account.audit]', JSON.stringify(payload));
}
