import { randomUUID } from 'crypto';

// One audit line per WhatWorks command, matching the declared events in
// docs/contracts/WHAT_WORKS_PLUGIN_AUDIT_CONTRACTS.yaml. Modeled on the directory/workforce
// audit helpers: a single structured console line that the platform log pipeline collects.

// Every WhatWorks command sits at contract version 1.0.0 today; kept as a map so a future
// per-command bump records the version that actually governed the call.
const WHAT_WORKS_COMMAND_VERSIONS: Record<string, string> = {
  'what-works.list.read': '1.0.0',
  'what-works.public.read': '1.0.0',
  'what-works.problems.list': '1.0.0',
  'what-works.product.suggest': '1.0.0',
  'what-works.product.endorse': '1.0.0',
  'what-works.product.unendorse': '1.0.0',
  'what-works.admin.problem.list': '1.0.0',
  'what-works.admin.problem.create': '1.0.0',
  'what-works.admin.problem.update': '1.0.0',
  'what-works.admin.problem.delete': '1.0.0',
  'what-works.admin.product.list': '1.0.0',
  'what-works.admin.product.review': '1.0.0',
  'what-works.admin.product.update': '1.0.0',
  'what-works.admin.product.delete': '1.0.0',
};

// The data classes each command touches, mirrored from the audit contract so the recorded
// line carries the same classification the contract declares.
const WHAT_WORKS_COMMAND_DATA_CLASSES: Record<string, string[]> = {
  'what-works.list.read': ['community_content'],
  'what-works.public.read': ['community_content'],
  'what-works.problems.list': ['community_content'],
  'what-works.product.suggest': ['community_content', 'user_event'],
  'what-works.product.endorse': ['user_event'],
  'what-works.product.unendorse': ['user_event'],
  'what-works.admin.problem.list': ['community_content'],
  'what-works.admin.problem.create': ['community_content'],
  'what-works.admin.problem.update': ['community_content'],
  'what-works.admin.problem.delete': ['community_content', 'user_event'],
  'what-works.admin.product.list': ['community_content'],
  'what-works.admin.product.review': ['community_content'],
  'what-works.admin.product.update': ['community_content'],
  'what-works.admin.product.delete': ['community_content', 'user_event'],
};

type WhatWorksAuditEvent = {
  // The acting member's id, or null for the unauthenticated public read.
  actorId: string | null;
  command: string;
  status: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'failure';
  errorCategory?: string | null;
  metadata?: Record<string, unknown>;
};

export function logWhatWorksAudit(event: WhatWorksAuditEvent): void {
  const payload = {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId: event.actorId ?? 'anonymous',
    pluginId: 'what-works',
    command: event.command,
    commandVersion: WHAT_WORKS_COMMAND_VERSIONS[event.command] ?? '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      targetType: event.targetType,
      targetId: event.targetId,
    },
    dataClassesAccessed: WHAT_WORKS_COMMAND_DATA_CLASSES[event.command] ?? [],
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[what-works.audit]', JSON.stringify(payload));
}
