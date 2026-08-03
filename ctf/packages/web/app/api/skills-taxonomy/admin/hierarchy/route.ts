import { NextResponse } from 'next/server';
import { requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { getHierarchy } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Admin reads deliberately use an opt-OUT model: inactive (soft-deleted/disabled)
// records are included by default so admins see the full taxonomy, and a caller
// must pass `includeInactive=false` to hide them. This is the inverse of the
// public `/api/skills-taxonomy/hierarchy` endpoint, which opts IN (members see
// only active records unless they explicitly ask for inactive ones). The two
// defaults are intentionally different because the audiences differ.
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
    reportError(error, { area: 'skills-taxonomy', op: 'admin_hierarchy' });
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
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: `Unable to load admin hierarchy: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
