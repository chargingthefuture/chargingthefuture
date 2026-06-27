import { randomUUID } from 'crypto';

type DirectoryAuditEvent = {
  actorId: string;
  command: string;
  status: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'failure';
  errorCategory: string | null;
  metadata?: Record<string, unknown>;
  // The audit contract (DIRECTORY_PLUGIN_AUDIT_CONTRACTS.yaml) requires a workspaceId in
  // targetContext and a top-level requestId + traceId on every event, for cross-service
  // correlation and compliance tracing. They are optional on the call site so existing
  // callers keep compiling; when a caller does not pass them the helper records 'unknown'
  // rather than dropping the field, so the serialized payload always matches the schema shape.
  workspaceId?: string | null;
  requestId?: string | null;
  traceId?: string | null;
};

export function logDirectoryAudit(event: DirectoryAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId,
    pluginId: 'directory',
    command: event.command,
    commandVersion: '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      workspaceId: event.workspaceId ?? 'unknown',
      targetType: event.targetType,
      targetId: event.targetId,
    },
    requestId: event.requestId ?? 'unknown',
    traceId: event.traceId ?? 'unknown',
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[directory.audit]', JSON.stringify(payload));
}
