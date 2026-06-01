import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { createSkill, listSkills, validateSkillCreateInput } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

type SkillCreateBody = {
  jobTitleId?: unknown;
  name?: unknown;
  displayOrder?: unknown;
  aliases?: unknown;
};

function parseIncludeInactive(url: string): boolean {
  return new URL(url).searchParams.get('includeInactive') !== 'false';
}

export async function GET(request: Request) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const skills = await listSkills(parseIncludeInactive(request.url));
    return NextResponse.json({ items: skills }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_skills' });
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to list skills.' },
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

  let body: SkillCreateBody;
  try {
    body = (await request.json()) as SkillCreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = {
    jobTitleId: typeof body.jobTitleId === 'string' ? body.jobTitleId : '',
    name: typeof body.name === 'string' ? body.name : '',
    displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : undefined,
    aliases: Array.isArray(body.aliases) ? body.aliases.filter((entry): entry is string => typeof entry === 'string') : undefined,
  };

  if (!validateSkillCreateInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid skill payload.' },
      { status: 400 },
    );
  }

  try {
    const skill = await createSkill(input);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.skill.create',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { skillId: skill.id, jobTitleId: skill.jobTitleId },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, skill }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.skill.create',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { jobTitleId: input.jobTitleId },
      result: 'failure',
      errorCategory: errorMessage === 'job_title_not_found' ? 'not_found' : 'persistence_error',
    });

    if (errorMessage === 'job_title_not_found') {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Parent job title not found.' },
        { status: 404 },
      );
    }

    reportError(error, { area: 'skills-taxonomy', op: 'admin_skills' });
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to create skill.' },
      { status: 503 },
    );
  }
}
