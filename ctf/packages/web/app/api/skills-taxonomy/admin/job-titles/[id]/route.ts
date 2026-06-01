import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTaxonomyAdminAccess } from '../../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import {
  deleteTaxonomyTarget,
  getJobTitleById,
  updateJobTitle,
  validateDeleteInput,
  validateJobTitleUpdateInput,
} from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

type JobTitleUpdateBody = {
  sectorId?: unknown;
  name?: unknown;
  displayOrder?: unknown;
  isActive?: unknown;
};

type DeleteBody = {
  reason?: unknown;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  try {
    const jobTitle = await getJobTitleById(id);
    if (!jobTitle) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Job title not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(jobTitle, { status: 200 });
  } catch (error) {
    reportError(error, {
      area: 'skills-taxonomy',
      op: 'get_job_title',
      extra: { userId: gate.auth.userId, id },
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to read job title.' },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await context.params;

  let body: JobTitleUpdateBody;
  try {
    body = (await request.json()) as JobTitleUpdateBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = {
    id,
    sectorId: typeof body.sectorId === 'string' ? body.sectorId : undefined,
    name: typeof body.name === 'string' ? body.name : undefined,
    displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  };

  if (!validateJobTitleUpdateInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid job title update payload.' },
      { status: 400 },
    );
  }

  try {
    const jobTitle = await updateJobTitle(input);
    if (!jobTitle) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Job title not found.' },
        { status: 404 },
      );
    }

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.job-title.update',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { jobTitleId: id },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, jobTitle }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    const notFound = errorMessage === 'sector_not_found';

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.job-title.update',
      actorId: gate.auth.userId,
      status: notFound ? 'deny' : 'allow',
      reason: notFound ? 'invalid_parent_sector' : 'admin_or_taxonomy_admin',
      target: { jobTitleId: id },
      result: 'failure',
      errorCategory: notFound ? 'not_found' : 'persistence_error',
    });

    if (notFound) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Parent sector not found.' },
        { status: 404 },
      );
    }

    reportError(error, {
      area: 'skills-taxonomy',
      op: 'update_job_title',
      extra: { userId: gate.auth.userId, id },
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to update job title.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await context.params;

  let reason = new URL(request.url).searchParams.get('reason') ?? '';
  if (!reason) {
    try {
      const body = (await request.json()) as DeleteBody;
      reason = typeof body.reason === 'string' ? body.reason : '';
    } catch {
      reason = '';
    }
  }

  if (!validateDeleteInput('job-title', id, reason)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Delete reason is required.' },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteTaxonomyTarget('job-title', id, gate.auth.userId, reason);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.job-title.delete',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'destructive_policy_passed',
      target: { jobTitleId: id },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, jobTitleId: id, deleted: true, deletedAt: deleted.deletedAtIso }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    const conflict = errorMessage === 'unresolved_downstream_dependencies' || errorMessage === 'destructive_threshold_exceeded';
    const notFound = errorMessage === 'job_title_not_found';

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.job-title.delete',
      actorId: gate.auth.userId,
      status: conflict || notFound ? 'deny' : 'allow',
      reason: conflict ? errorMessage : notFound ? 'job_title_not_found' : 'admin_or_taxonomy_admin',
      target: { jobTitleId: id },
      result: 'failure',
      errorCategory: conflict ? 'dependency_conflict' : notFound ? 'not_found' : 'persistence_error',
    });

    if (notFound) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Job title not found.' },
        { status: 404 },
      );
    }

    if (conflict) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.conflict, message: 'Job title delete blocked by dependency safeguards.' },
        { status: 409 },
      );
    }

    reportError(error, {
      area: 'skills-taxonomy',
      op: 'delete_job_title',
      extra: { userId: gate.auth.userId, id },
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete job title.' },
      { status: 503 },
    );
  }
}
