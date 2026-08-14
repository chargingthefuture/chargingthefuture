import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { readTrustSelfExtensionOrStored } from 'lib/trust/repository';
import { logTrustAuditEvent } from 'lib/trust/audit';
import { resolveRequestId } from 'lib/trust/_lib';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  const requestId = resolveRequestId(request);

  // Recompute the caller's trust signals from their current participation before returning, so the
  // panel reflects what they have actually done instead of a frozen snapshot that nothing ever
  // refreshed. Trust is signal-only — there is no verification status to change here.
  //
  // This is a GET, so the recompute is throttled: readTrustSelfExtension only writes a new snapshot
  // when the last one is older than the refresh window (or none exists yet), and otherwise returns
  // the stored extension without a write. That keeps the panel fresh-on-load while bounding the DB
  // writes to once per window per user, so a cross-site forced GET cannot drive unbounded snapshot
  // inserts even though this read is not CSRF-guarded.
  //
  // Resilience: if the recompute throws (an upstream table is briefly unavailable, the DB hiccups,
  // etc.) fall back to the last stored extension so the panel still renders the most recent good
  // evidence instead of erroring. A failed refresh must never break the member's own read.
  //
  // Both the throttle and that fallback live in readTrustSelfExtensionOrStored, which the
  // server-rendered self surfaces (account hub, home, apps launcher) call too — so this route and
  // those pages cannot drift into showing the same member two different panels.
  const extension = await readTrustSelfExtensionOrStored(decision.userId);

  // Record the trust.summary.read audit event required by the audit contract. A failed audit write
  // must never break the member's own read, so log-and-continue on error.
  try {
    await logTrustAuditEvent({
      actorUserId: decision.userId,
      targetUserId: decision.userId,
      command: 'trust.summary.read',
      policyStatus: 'allow',
      reason: 'self_summary_read',
      requestId,
      metadata: { viewerUserId: decision.userId, subjectUserId: decision.userId, surface: 'self' },
    });
  } catch (error) {
    reportError(error, { area: 'trust', op: 'self_summary_read_audit' });
  }

  return NextResponse.json(extension, { status: 200 });
}
