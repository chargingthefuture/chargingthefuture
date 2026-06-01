import { NextResponse } from 'next/server';
import { requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { getHierarchy } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

function parseIncludeInactive(url: string): boolean {
  return new URL(url).searchParams.get('includeInactive') !== 'false';
}

export async function GET(request: Request) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const includeInactive = parseIncludeInactive(request.url);

  try {
    const items = await getHierarchy(includeInactive);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.hierarchy.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: {
        scope: 'admin',
        includeInactive: String(includeInactive),
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ items, generatedAt: new Date().toISOString() }, { status: 200 });
  } catch (error) {
    reportError(error, {
      area: 'skills-taxonomy',
      op: 'get_admin_hierarchy',
      extra: { userId: gate.auth.userId },
    });

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.hierarchy.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: {
        scope: 'admin',
      },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to load admin hierarchy.' },
      { status: 503 },
    );
  }
}
