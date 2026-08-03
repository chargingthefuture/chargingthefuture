import { NextResponse } from 'next/server';
import { requireSafetyAdminAccess, ensureMutationCsrf } from '../../../_lib';
import { SAFETY_ERROR_CODE } from 'lib/safety/constants';
import { insertSafetyAdminAudit, setSafetyReportStatus } from 'lib/safety/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type ReviewBody = { action?: unknown };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mark a member safety report reviewed or dismissed (issue #809, task 3). This is triage only — the
// admin's actual global ban is a separate, later task (task 5). `reviewed` records that the admin
// looked at / acted on the report; `dismissed` records that it was not a real safety concern. Both
// only move a report that is currently open, so a double action is a harmless no-op. Admin-gated,
// CSRF on write.
export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const gate = await requireSafetyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { reportId } = await params;
  if (!UUID_REGEX.test(reportId)) {
    return NextResponse.json(
      { ok: false, code: SAFETY_ERROR_CODE.invalidPayload, message: 'Invalid report id.' },
      { status: 400 },
    );
  }

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: SAFETY_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  if (body.action !== 'reviewed' && body.action !== 'dismissed') {
    return NextResponse.json(
      { ok: false, code: SAFETY_ERROR_CODE.invalidPayload, message: 'action must be "reviewed" or "dismissed".' },
      { status: 400 },
    );
  }

  try {
    const changed = await setSafetyReportStatus(reportId, body.action, gate.auth.userId);
    if (!changed) {
      // No row moved: the report was already actioned or does not exist.
      return NextResponse.json(
        { ok: false, code: SAFETY_ERROR_CODE.forbidden, message: 'This report is no longer open.' },
        { status: 409 },
      );
    }

    // Record the moderation decision in the append-only audit trail. Best-effort: a report was
    // already moved above, so an audit-write failure must not turn a successful action into an error.
    try {
      await insertSafetyAdminAudit({
        actorId: gate.auth.userId,
        command: 'safety.report.review',
        reason: body.action,
        targetType: 'safety_report',
        targetId: reportId,
        metadata: { action: body.action },
      });
    } catch (auditError) {
      reportError(auditError, { area: 'safety', op: 'admin_report_review_audit' });
    }

    return NextResponse.json({ ok: true, reportId, status: body.action }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'safety', op: 'admin_report_review' });
    return NextResponse.json(
      { ok: false, code: SAFETY_ERROR_CODE.persistenceUnavailable, message: `Unable to update this report: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
