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

type DeleteFailureKind = 'not_found' | 'conflict' | 'error';

// Maps a repository delete error message to a coarse outcome. `notFoundCode` is
// the entity-specific "not found" message the repository throws.
function classifyDeleteFailure(errorMessage: string, notFoundCode: string): DeleteFailureKind {
  if (errorMessage === notFoundCode) {
    return 'not_found';
  }

  if (errorMessage === 'unresolved_downstream_dependencies' || errorMessage === 'destructive_threshold_exceeded') {
    return 'conflict';
  }

  return 'error';
}

// Resolves the delete reason from the query string, falling back to the JSON
// body when the query parameter is absent.
async function resolveDeleteReason(request: Request): Promise<string> {
  let reason = new URL(request.url).searchParams.get('reason') ?? '';
  if (!reason) {
    try {
      const body = (await request.json()) as DeleteBody;
      reason = typeof body.reason === 'string' ? body.reason : '';
    } catch {
      reason = '';
    }
  }

  return reason;
}

function buildJobTitleUpdateInput(id: string, body: JobTitleUpdateBody) {
  return {
    id,
    sectorId: typeof body.sectorId === 'string' ? body.sectorId : undefined,
    name: typeof body.name === 'string' ? body.name : undefined,
    displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  };
}

// Shared failure path for job title updates: records the audit outcome and maps
// a missing parent sector to 404 / everything else to 503.
function handleJobTitleUpdateFailure(error: unknown, actorId: string, id: string): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'unknown_error';
  const notFound = errorMessage === 'sector_not_found';

  logSkillsTaxonomyAudit({
    pluginId: 'skills-taxonomy',
    command: 'skills-taxonomy.job-title.update',
    actorId,
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

  reportError(error, { area: 'skills-taxonomy', op: 'admin_job_titles_id' });
  return NextResponse.json(
    { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to update job title.' },
    { status: 503 },
  );
}

// Shared failure path for job title deletion: records the audit outcome and maps
// a missing target to 404 / dependency safeguards to 409 / everything else to 503.
function handleJobTitleDeleteFailure(error: unknown, actorId: string, id: string): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'unknown_error';
  const kind = classifyDeleteFailure(errorMessage, 'job_title_not_found');
  const errorCategory =
    kind === 'conflict' ? 'dependency_conflict' : kind === 'not_found' ? 'not_found' : 'persistence_error';

  logSkillsTaxonomyAudit({
    pluginId: 'skills-taxonomy',
    command: 'skills-taxonomy.job-title.delete',
    actorId,
    status: kind === 'error' ? 'allow' : 'deny',
    reason: kind === 'error' ? 'admin_or_taxonomy_admin' : errorMessage,
    target: { jobTitleId: id },
    result: 'failure',
    errorCategory,
  });

  if (kind === 'not_found') {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Job title not found.' },
      { status: 404 },
    );
  }

  if (kind === 'conflict') {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.conflict, message: 'Job title delete blocked by dependency safeguards.' },
      { status: 409 },
    );
  }

  reportError(error, { area: 'skills-taxonomy', op: 'admin_job_titles_id' });
  return NextResponse.json(
    { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete job title.' },
    { status: 503 },
  );
}

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
    reportError(error, { area: 'skills-taxonomy', op: 'admin_job_titles_id' });
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

  const input = buildJobTitleUpdateInput(id, body);

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
    return handleJobTitleUpdateFailure(error, gate.auth.userId, id);
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

  const reason = await resolveDeleteReason(request);

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
    return handleJobTitleDeleteFailure(error, gate.auth.userId, id);
  }
}
