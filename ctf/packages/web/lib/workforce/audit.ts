import { randomUUID } from 'crypto';

// The product is single-tenant: there is no workspace concept on the auth decision (see
// lib/auth/server-authz AllowDecision). The audit contracts still carry a `workspaceId` field from
// the shared template, so we record this constant for it rather than a real per-workspace value.
export const WORKFORCE_AUDIT_WORKSPACE = 'global';

// Contract version per command, so audit entries record the version that actually governs the command
// (the command contracts put several at 2.0.0). Falls back to 1.0.0 for anything not listed.
const WORKFORCE_COMMAND_VERSIONS: Record<string, string> = {
  'workforce.dashboard.fetch': '2.0.0',
  'workforce.profile.fetch': '2.0.0',
  'workforce.profile.delete': '2.0.0',
  'workforce.occupations.list': '2.0.0',
  'workforce.occupations.detail.fetch': '2.0.0',
  'workforce.report.skillLevel.fetch': '2.0.0',
  'workforce.report.sector.fetch': '2.0.0',
  'workforce.report.occupations.fetch': '1.0.0',
  'workforce.admin.config.fetch': '2.0.0',
  'workforce.admin.config.update': '2.0.0',
  'workforce.admin.auditEvents.fetch': '1.0.0',
};

type WorkforceAuditEvent = {
  actorId: string;
  command: string;
  status: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'failure';
  errorCategory: string | null;
  metadata?: Record<string, unknown>;
  // Top-level correlation ids required by the audit contracts. Routes read these from the
  // x-request-id / x-trace-id headers; null when the caller did not supply them.
  requestId?: string | null;
  traceId?: string | null;
  // Extra targetContext fields a specific command's audit contract requires (e.g. workspaceId,
  // userId, dashboardRequestId, configVersion). Merged alongside targetType / targetId.
  targetContext?: Record<string, string | null | undefined>;
};

export function logWorkforceAudit(event: WorkforceAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'workforce',
    command: event.command,
    commandVersion: WORKFORCE_COMMAND_VERSIONS[event.command] ?? '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      targetType: event.targetType,
      targetId: event.targetId,
      ...(event.targetContext ?? {}),
    },
    requestId: event.requestId ?? null,
    traceId: event.traceId ?? null,
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[workforce.audit]', JSON.stringify(payload));
}
