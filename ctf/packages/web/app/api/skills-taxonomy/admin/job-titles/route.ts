import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { createJobTitle, listJobTitles, validateJobTitleCreateInput } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

type JobTitleCreateBody = {
  sectorId?: unknown;
  name?: unknown;
  displayOrder?: unknown;
};

// Admin list reads use the opt-OUT default (inactive records included unless
// `includeInactive=false`), matching admin/hierarchy and the inverse of the
// public read endpoint. See app/api/skills-taxonomy/hierarchy/route.ts.
function parseIncludeInactive(url: string): boolean {
  return new URL(url).searchParams.get('includeInactive') !== 'false';
}

// Shared failure path for job title creation: records the audit outcome and
// maps a missing parent sector to 404 / everything else to 503.
function handleJobTitleCreateFailure(error: unknown, actorId: string, sectorId: string): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'unknown_error';

  logSkillsTaxonomyAudit({
    pluginId: 'skills-taxonomy',
    command: 'skills-taxonomy.job-title.create',
    actorId,
    status: 'allow',
    reason: 'admin_or_taxonomy_admin',
    target: { sectorId },
    result: 'failure',
    errorCategory: errorMessage === 'sector_not_found' ? 'not_found' : 'persistence_error',
  });

  if (errorMessage === 'sector_not_found') {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Parent sector not found.' },
      { status: 404 },
    );
  }

  reportError(error, { area: 'skills-taxonomy', op: 'admin_job_titles' });
  return NextResponse.json(
    { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to create job title.' },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const jobTitles = await listJobTitles(parseIncludeInactive(request.url));

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.hierarchy.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { scope: 'admin', resource: 'job-titles' },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ items: jobTitles }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_job_titles' });
    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.hierarchy.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { scope: 'admin', resource: 'job-titles' },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to list job titles.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: JobTitleCreateBody;
  try {
    body = (await request.json()) as JobTitleCreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = {
    sectorId: typeof body.sectorId === 'string' ? body.sectorId : '',
    name: typeof body.name === 'string' ? body.name : '',
    displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : undefined,
  };

  if (!validateJobTitleCreateInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid job title payload.' },
      { status: 400 },
    );
  }

  try {
    const jobTitle = await createJobTitle(input);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.job-title.create',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { jobTitleId: jobTitle.id, sectorId: jobTitle.sectorId },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, jobTitle }, { status: 201 });
  } catch (error) {
    return handleJobTitleCreateFailure(error, gate.auth.userId, input.sectorId);
  }
}
