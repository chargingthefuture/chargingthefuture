import { NextResponse } from 'next/server';
import { requireBugReportAdminAccess, ensureMutationCsrf } from '../../../_lib';
import { BUG_REPORT_ERROR_CODE } from 'lib/bug-reports/constants';
import { releaseHeldReport, rejectReport } from 'lib/bug-reports/repository';
import { recordBugReportAdminAudit } from 'lib/bug-reports/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type ResolveBody = { action?: unknown };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidPayload(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: BUG_REPORT_ERROR_CODE.invalidPayload, message },
    { status: 400 },
  );
}

// Validate the report id and request body, resolving the action. Returns a discriminated result so
// the caller keeps TypeScript narrowing on the validated action.
async function parseResolveRequest(
  id: string,
  request: Request,
): Promise<{ error: NextResponse } | { data: { action: 'release' | 'reject' } }> {
  if (!UUID_REGEX.test(id)) {
    return { error: invalidPayload('Invalid report id.') };
  }

  let body: ResolveBody;
  try {
    body = (await request.json()) as ResolveBody;
  } catch {
    return { error: invalidPayload('Invalid JSON body.') };
  }

  if (body.action !== 'release' && body.action !== 'reject') {
    return { error: invalidPayload('action must be "release" or "reject".') };
  }

  return { data: { action: body.action } };
}

// Resolve a held (or new) bug report. `release` sends it back to `new` so the create-issues
// job publishes the redacted copy to the triage repo; `reject` drops it so it never does.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireBugReportAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;
  const parsed = await parseResolveRequest(id, request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { action } = parsed.data;

  try {
    const changed =
      action === 'release' ? await releaseHeldReport(id) : await rejectReport(id);

    if (!changed) {
      // No row moved: the report was already resolved (published/rejected) or does not exist.
      // Recorded too — an admin reaching for a report that is already gone is worth seeing, and the
      // point of the trail is that what did not happen is as legible as what did.
      await recordBugReportAdminAudit({
        actorId: gate.auth.userId,
        command: 'bug-reports.admin.resolve',
        status: 'deny',
        reason: 'not_resolvable',
        targetId: id,
        result: 'failure',
        errorCategory: 'conflict',
        metadata: { action },
      });
      return NextResponse.json(
        { ok: false, code: BUG_REPORT_ERROR_CODE.forbidden, message: 'Report is not in a state that can be resolved.' },
        { status: 409 },
      );
    }

    const newStatus = action === 'release' ? 'new' : 'rejected';
    await recordBugReportAdminAudit({
      actorId: gate.auth.userId,
      command: 'bug-reports.admin.resolve',
      status: 'allow',
      reason: 'admin_route_guard',
      targetId: id,
      result: 'success',
      errorCategory: null,
      metadata: { action, toStatus: newStatus },
    });
    return NextResponse.json({ ok: true, id, status: newStatus }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'bug-reports', op: 'admin-resolve' });
    await recordBugReportAdminAudit({
      actorId: gate.auth.userId,
      command: 'bug-reports.admin.resolve',
      status: 'allow',
      reason: 'admin_route_guard',
      targetId: id,
      result: 'failure',
      errorCategory: 'persistence_error',
      metadata: { action },
    });
    return NextResponse.json(
      {
        ok: false,
        code: BUG_REPORT_ERROR_CODE.persistenceUnavailable,
        message: `Unable to resolve this report: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
