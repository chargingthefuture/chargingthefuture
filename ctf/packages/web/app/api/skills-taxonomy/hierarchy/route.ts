import { NextResponse } from 'next/server';
import { requireTaxonomyReadAccess } from '../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { getHierarchy } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

function parseIncludeInactive(url: string): boolean {
  return new URL(url).searchParams.get('includeInactive') === 'true';
}

export async function GET(request: Request) {
  const gate = await requireTaxonomyReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await getHierarchy(parseIncludeInactive(request.url));

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.hierarchy.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {
        includeInactive: String(parseIncludeInactive(request.url)),
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(
      {
        items,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, {
      area: 'skills-taxonomy',
      op: 'get_hierarchy',
      extra: { userId: gate.auth.userId },
    });

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.hierarchy.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {},
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to read taxonomy hierarchy.',
      },
      { status: 503 },
    );
  }
}
