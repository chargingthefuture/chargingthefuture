import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { createSector, listSectors, validateSectorCreateInput } from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

type SectorCreateBody = {
  name?: unknown;
  displayOrder?: unknown;
  workforceShare?: unknown;
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
    const sectors = await listSectors(parseIncludeInactive(request.url));
    return NextResponse.json({ items: sectors }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_sectors' });
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to list sectors.' },
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

  let body: SectorCreateBody;
  try {
    body = (await request.json()) as SectorCreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = {
    name: typeof body.name === 'string' ? body.name : '',
    displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : undefined,
    workforceShare: typeof body.workforceShare === 'number' ? body.workforceShare : undefined,
  };

  if (!validateSectorCreateInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid sector payload.' },
      { status: 400 },
    );
  }

  try {
    const sector = await createSector(input);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.sector.create',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { sectorId: sector.id },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, sector }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_sectors' });
    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.sector.create',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: {},
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to create sector.' },
      { status: 503 },
    );
  }
}
