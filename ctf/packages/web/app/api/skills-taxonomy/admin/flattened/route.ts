import { NextResponse } from 'next/server';
import { requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { getFlattened } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

function parseBooleanParam(url: string, name: string): boolean {
  return new URL(url).searchParams.get(name) === 'true';
}

export async function GET(request: Request) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const includeInactive = parseBooleanParam(request.url, 'includeInactive');
  const includeAliases = parseBooleanParam(request.url, 'includeAliases');

  try {
    const items = await getFlattened(includeInactive, includeAliases);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.flattened.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: {
        scope: 'admin',
        includeInactive: String(includeInactive),
        includeAliases: String(includeAliases),
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ items, generatedAt: new Date().toISOString() }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_flattened' });
    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.flattened.get',
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
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable,
        message: `Unable to load admin flattened taxonomy: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
