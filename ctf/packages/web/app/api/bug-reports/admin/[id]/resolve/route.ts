import { NextResponse } from 'next/server';
import { requireBugReportAdminAccess, ensureMutationCsrf } from '../../../_lib';
import { BUG_REPORT_ERROR_CODE } from 'lib/bug-reports/constants';
import { releaseHeldReport, rejectReport } from 'lib/bug-reports/repository';
import { reportError } from 'lib/observability/report';

type ResolveBody = { action?: unknown };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.invalidPayload, message: 'Invalid report id.' },
      { status: 400 },
    );
  }

  let body: ResolveBody;
  try {
    body = (await request.json()) as ResolveBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  if (body.action !== 'release' && body.action !== 'reject') {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.invalidPayload, message: 'action must be "release" or "reject".' },
      { status: 400 },
    );
  }

  try {
    const changed =
      body.action === 'release' ? await releaseHeldReport(id) : await rejectReport(id);

    if (!changed) {
      // No row moved: the report was already resolved (published/rejected) or does not exist.
      return NextResponse.json(
        { ok: false, code: BUG_REPORT_ERROR_CODE.forbidden, message: 'Report is not in a state that can be resolved.' },
        { status: 409 },
      );
    }

    const newStatus = body.action === 'release' ? 'new' : 'rejected';
    return NextResponse.json({ ok: true, id, status: newStatus }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'bug-reports', op: 'admin-resolve' });
    return NextResponse.json(
      {
        ok: false,
        code: BUG_REPORT_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to resolve this report.',
      },
      { status: 503 },
    );
  }
}
