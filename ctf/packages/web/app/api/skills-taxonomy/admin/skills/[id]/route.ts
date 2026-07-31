import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTaxonomyAdminAccess } from '../../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import {
  deleteTaxonomyTarget,
  getSkillById,
  updateSkill,
  validateDeleteInput,
  validateSkillUpdateInput,
} from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

type SkillUpdateBody = {
  jobTitleId?: unknown;
  name?: unknown;
  displayOrder?: unknown;
  aliases?: unknown;
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

function buildSkillUpdateInput(id: string, body: SkillUpdateBody) {
  return {
    id,
    jobTitleId: typeof body.jobTitleId === 'string' ? body.jobTitleId : undefined,
    name: typeof body.name === 'string' ? body.name : undefined,
    displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : undefined,
    aliases: Array.isArray(body.aliases) ? body.aliases.filter((entry): entry is string => typeof entry === 'string') : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  };
}

// Shared failure path for skill updates: records the audit outcome and maps a
// missing parent job title to 404 / everything else to 503.
function handleSkillUpdateFailure(error: unknown, actorId: string, id: string): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'unknown_error';
  const notFound = errorMessage === 'job_title_not_found';

  logSkillsTaxonomyAudit({
    pluginId: 'skills-taxonomy',
    command: 'skills-taxonomy.skill.update',
    actorId,
    status: notFound ? 'deny' : 'allow',
    reason: notFound ? 'invalid_parent_job_title' : 'admin_or_taxonomy_admin',
    target: { skillId: id },
    result: 'failure',
    errorCategory: notFound ? 'not_found' : 'persistence_error',
  });

  if (notFound) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Parent job title not found.' },
      { status: 404 },
    );
  }

  reportError(error, { area: 'skills-taxonomy', op: 'admin_skills_id' });
  return NextResponse.json(
    { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to update skill.' },
    { status: 503 },
  );
}

// Shared failure path for skill deletion: records the audit outcome and maps a
// missing target to 404 / dependency safeguards to 409 / everything else to 503.
function handleSkillDeleteFailure(error: unknown, actorId: string, id: string): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'unknown_error';
  const kind = classifyDeleteFailure(errorMessage, 'skill_not_found');
  const errorCategory =
    kind === 'conflict' ? 'dependency_conflict' : kind === 'not_found' ? 'not_found' : 'persistence_error';

  logSkillsTaxonomyAudit({
    pluginId: 'skills-taxonomy',
    command: 'skills-taxonomy.skill.delete',
    actorId,
    status: kind === 'error' ? 'allow' : 'deny',
    reason: kind === 'error' ? 'admin_or_taxonomy_admin' : errorMessage,
    target: { skillId: id },
    result: 'failure',
    errorCategory,
  });

  if (kind === 'not_found') {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Skill not found.' },
      { status: 404 },
    );
  }

  if (kind === 'conflict') {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.conflict, message: 'Skill delete blocked by dependency safeguards.' },
      { status: 409 },
    );
  }

  reportError(error, { area: 'skills-taxonomy', op: 'admin_skills_id' });
  return NextResponse.json(
    { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete skill.' },
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
    const skill = await getSkillById(id);
    if (!skill) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Skill not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(skill, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_skills_id' });
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to read skill.' },
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

  let body: SkillUpdateBody;
  try {
    body = (await request.json()) as SkillUpdateBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = buildSkillUpdateInput(id, body);

  if (!validateSkillUpdateInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid skill update payload.' },
      { status: 400 },
    );
  }

  try {
    const skill = await updateSkill(input);
    if (!skill) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Skill not found.' },
        { status: 404 },
      );
    }

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.skill.update',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { skillId: id },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, skill }, { status: 200 });
  } catch (error) {
    return handleSkillUpdateFailure(error, gate.auth.userId, id);
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

  if (!validateDeleteInput('skill', id, reason)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Delete reason is required.' },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteTaxonomyTarget('skill', id, gate.auth.userId, reason);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.skill.delete',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'destructive_policy_passed',
      target: { skillId: id },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, skillId: id, deleted: true, deletedAt: deleted.deletedAtIso }, { status: 200 });
  } catch (error) {
    return handleSkillDeleteFailure(error, gate.auth.userId, id);
  }
}
