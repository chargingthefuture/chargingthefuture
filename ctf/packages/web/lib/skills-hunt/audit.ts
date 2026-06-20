import { randomUUID } from 'crypto';

type SkillsHuntAuditEvent = {
  actorId: string;
  command: string;
  status: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'failure';
  errorCategory: string | null;
  metadata?: Record<string, unknown>;
  // Version of the command being audited. Defaults to the v1 baseline; callers
  // for a bumped command pass its current version so the log matches the contract.
  commandVersion?: string;
};

export function logSkillsHuntAudit(event: SkillsHuntAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'skills-hunt',
    command: event.command,
    commandVersion: event.commandVersion ?? '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      targetType: event.targetType,
      targetId: event.targetId,
    },
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[skills-hunt.audit]', JSON.stringify(payload));
}
