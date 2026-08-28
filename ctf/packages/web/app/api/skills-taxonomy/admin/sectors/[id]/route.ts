import { NextResponse } from 'next/server';
import { requireTaxonomyAdminAccess } from '../../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { getSectorById } from 'lib/skills-taxonomy/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Governance plan task 7 (2026-08-28): the write handlers are gone from this route. The Skills
// Taxonomy is governed by the append-only change list in ctf/scripts/lib/taxonomyChange.mjs — a
// change is appended in a PR, validated by the taxonomy-change-gate, and applied to production by
// the owner-run workflow. The POST/PUT/DELETE handlers here were a second write path that bypassed
// all of it: no change-list entry, no CI validation, no acknowledged-impact note on a deactivation.
// No screen ever called them. The read handler below stays.
// See ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  try {
    const sector = await getSectorById(id);
    if (!sector) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Sector not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(sector, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_sectors_id' });
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: `Unable to read sector: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
