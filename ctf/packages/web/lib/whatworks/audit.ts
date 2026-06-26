import { randomUUID } from 'crypto';

// One audit line per WhatWorks command, matching the declared events in
// docs/contracts/WHATWORKS_PLUGIN_AUDIT_CONTRACTS.yaml. Modelled on the directory/workforce
// audit helpers: a single structured console line that the platform log pipeline collects.

// Every WhatWorks command sits at contract version 1.0.0 today; kept as a map so a future
// per-command bump records the version that actually governed the call.
const WHATWORKS_COMMAND_VERSIONS: Record<string, string> = {
  'whatworks.list.read': '1.0.0',
  'whatworks.public.read': '1.0.0',
  'whatworks.problems.list': '1.0.0',
  'whatworks.product.suggest': '1.0.0',
  'whatworks.product.endorse': '1.0.0',
  'whatworks.product.unendorse': '1.0.0',
  'whatworks.admin.problem.list': '1.0.0',
  'whatworks.admin.problem.create': '1.0.0',
  'whatworks.admin.problem.update': '1.0.0',
  'whatworks.admin.problem.delete': '1.0.0',
  'whatworks.admin.product.list': '1.0.0',
  'whatworks.admin.product.review': '1.0.0',
  'whatworks.admin.product.delete': '1.0.0',
};

// The data classes each command touches, mirrored from the audit contract so the recorded
// line carries the same classification the contract declares.
const WHATWORKS_COMMAND_DATA_CLASSES: Record<string, string[]> = {
  'whatworks.list.read': ['community_content'],
  'whatworks.public.read': ['community_content'],
  'whatworks.problems.list': ['community_content'],
  'whatworks.product.suggest': ['community_content', 'user_event'],
  'whatworks.product.endorse': ['user_event'],
  'whatworks.product.unendorse': ['user_event'],
  'whatworks.admin.problem.list': ['community_content'],
  'whatworks.admin.problem.create': ['community_content'],
  'whatworks.admin.problem.update': ['community_content'],
  'whatworks.admin.problem.delete': ['community_content', 'user_event'],
  'whatworks.admin.product.list': ['community_content'],
  'whatworks.admin.product.review': ['community_content'],
  'whatworks.admin.product.delete': ['community_content', 'user_event'],
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
    pluginId: 'whatworks',
    command: event.command,
    commandVersion: WHATWORKS_COMMAND_VERSIONS[event.command] ?? '1.0.0',
    policyDecision: {
      status: event.status,
      reason: event.reason,
    },
    targetContext: {
      targetType: event.targetType,
      targetId: event.targetId,
    },
    dataClassesAccessed: WHATWORKS_COMMAND_DATA_CLASSES[event.command] ?? [],
    result: {
      status: event.result,
      errorCategory: event.errorCategory ?? 'none',
    },
    metadata: event.metadata ?? {},
  };

  console.info('[whatworks.audit]', JSON.stringify(payload));
}
