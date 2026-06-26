import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE, WORKFORCE_EXPORT_TYPES, isWorkforceExportType } from 'lib/workforce/constants';
import { createDeferredExportJob, insertWorkforceAdminAudit } from 'lib/workforce/repository';
import { logWorkforceAudit } from 'lib/workforce/audit';
import { reportError } from 'lib/observability/report';

type ExportBody = {
  exportType?: unknown;
};

export async function POST(request: Request) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  // Validate exportType against the allowed whitelist before creating the job. An unknown export
  // type is rejected so a deferred job row is never written for a dataset the plugin cannot produce.
  const exportType = body.exportType;
  if (!isWorkforceExportType(exportType)) {
    return NextResponse.json(
      {
        ok: false,
        code: WORKFORCE_ERROR_CODE.invalidPayload,
        message: `Invalid exportType. Allowed values: ${WORKFORCE_EXPORT_TYPES.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  try {
    const job = await createDeferredExportJob(gate.auth.userId, exportType);

    // Persist the admin-mutation audit row (queryable trail) and emit the structured audit event.
    // This command is containsPHI=true, so the audit evidence carries the export-scope and PII-guard
    // checks the audit contract (WORKFORCE_PLUGIN_AUDIT_CONTRACTS.yaml, workforce.export.job.create,
    // deferred variant) requires: roleCheck (admin gate passed), exportScopeCheck (exportType is an
    // allowed dataset), and piiGuardCheck (no member-identifying rows leave the system because
    // execution is deferred — the job is recorded, not run). defermentCheck records the deferral.
    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.export.job.create',
      policyStatus: 'allow',
      reason: 'export_deferred_by_product_decision',
      targetType: 'export_job',
      targetId: job.id,
      metadata: {
        status: job.status,
        exportType: job.exportType,
        evidence: {
          roleCheck: 'pass',
          exportScopeCheck: 'pass',
          piiGuardCheck: 'pass',
          defermentCheck: 'pass',
        },
      },
    });

    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.export.job.create',
      status: 'allow',
      reason: 'export_deferred_by_product_decision',
      targetType: 'export_job',
      targetId: job.id,
      result: 'success',
      errorCategory: 'deferred',
      metadata: {
        exportType: job.exportType,
        evidence: {
          roleCheck: 'pass',
          exportScopeCheck: 'pass',
          piiGuardCheck: 'pass',
          defermentCheck: 'pass',
        },
      },
    });

    return NextResponse.json(
      {
        ok: false,
        code: WORKFORCE_ERROR_CODE.exportDeferred,
        message: 'Export workflow is deferred for this phase. Job recorded as deferred.',
        job,
      },
      { status: 501 },
    );
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'export_jobs' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to create export job.' },
      { status: 503 },
    );
  }
}
