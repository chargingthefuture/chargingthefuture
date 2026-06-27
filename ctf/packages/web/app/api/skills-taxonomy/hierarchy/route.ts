import { NextResponse } from 'next/server';
import { requireTaxonomyReadAccess } from '../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { getHierarchy } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

// Public reads deliberately use an opt-IN model: members see only active records
// by default and must pass `includeInactive=true` to also see inactive ones. This
// is the inverse of the admin `/api/skills-taxonomy/admin/hierarchy` endpoint,
// which opts OUT (admins see everything unless they pass `includeInactive=false`).
// The two defaults are intentionally different because the audiences differ.
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
    reportError(error, { area: 'skills-taxonomy', op: 'hierarchy' });
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
