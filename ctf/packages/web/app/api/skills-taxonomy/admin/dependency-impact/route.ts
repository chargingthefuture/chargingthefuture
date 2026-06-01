import { NextResponse } from 'next/server';
import { requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { previewDependencyImpact, validateDependencyPreviewInput } from 'lib/skills-taxonomy/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: Request) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const targetType = url.searchParams.get('targetType') ?? '';
  const targetId = url.searchParams.get('targetId') ?? '';

  if (!validateDependencyPreviewInput(targetType, targetId)) {
    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload,
        message: 'Invalid dependency targetType/targetId.',
      },
      { status: 400 },
    );
  }

  try {
    const impact = await previewDependencyImpact(targetType, targetId);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.dependency-impact.preview',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: {
        targetType,
        targetId,
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(impact, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_dependency_impact' });
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    const notFound = errorMessage.endsWith('_not_found');

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.dependency-impact.preview',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: {
        targetType,
        targetId,
      },
      result: 'failure',
      errorCategory: notFound ? 'not_found' : 'persistence_error',
    });

    if (notFound) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Taxonomy target not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to preview dependency impact.' },
      { status: 503 },
    );
  }
}
