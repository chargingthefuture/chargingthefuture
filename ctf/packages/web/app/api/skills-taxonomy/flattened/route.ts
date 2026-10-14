import { NextResponse } from 'next/server';
import { requireTaxonomyReadAccess } from '../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { getFlattened } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

function parseBooleanParam(url: string, name: string): boolean {
  return new URL(url).searchParams.get(name) === 'true';
}

export async function GET(request: Request) {
  const gate = await requireTaxonomyReadAccess(request);
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
      actorId: gate.reader.actorId,
      status: 'allow',
      reason: gate.reader.reason,
      target: {
        includeInactive: String(includeInactive),
        includeAliases: String(includeAliases),
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
    reportError(error, { area: 'skills-taxonomy', op: 'flattened' });
    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.flattened.get',
      actorId: gate.reader.actorId,
      status: 'allow',
      reason: gate.reader.reason,
      target: {},
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to read taxonomy flattened projection.',
      },
      { status: 503 },
    );
  }
}
