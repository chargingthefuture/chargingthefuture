import { NextResponse } from 'next/server';
import { requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { listSectors } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

function parseIncludeInactive(url: string): boolean {
  return new URL(url).searchParams.get('includeInactive') !== 'false';
}

// Governance plan task 7 (2026-08-28): the write handlers are gone from this route. The Skills
// Taxonomy is governed by the append-only change list in ctf/scripts/lib/taxonomyChange.mjs — a
// change is appended in a PR, validated by the taxonomy-change-gate, and applied to production by
// the owner-run workflow. These POST/PUT/DELETE handlers were a second write path that bypassed all
// of it: no change-list entry, no CI validation, no acknowledged-impact note on a deactivation. No
// screen ever called them. The read handler below stays.
// See ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md.
export async function GET(request: Request) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const sectors = await listSectors(parseIncludeInactive(request.url));

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.hierarchy.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { scope: 'admin', resource: 'sectors' },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ items: sectors }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_sectors' });
    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.hierarchy.get',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { scope: 'admin', resource: 'sectors' },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: `Unable to list sectors: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
