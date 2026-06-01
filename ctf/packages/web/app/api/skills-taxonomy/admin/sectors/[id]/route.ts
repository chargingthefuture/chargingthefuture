import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTaxonomyAdminAccess } from '../../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import {
  deleteTaxonomyTarget,
  getSectorById,
  updateSector,
  validateDeleteInput,
  validateSectorUpdateInput,
} from 'lib/skills-taxonomy/repository';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { reportError } from 'lib/observability/report';

type SectorUpdateBody = {
  name?: unknown;
  displayOrder?: unknown;
  workforceShare?: unknown;
  isActive?: unknown;
};

type DeleteBody = {
  reason?: unknown;
};

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
    reportError(error, {
      area: 'skills-taxonomy',
      op: 'get_sector',
      extra: { userId: gate.auth.userId, id },
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to read sector.' },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await context.params;

  let body: SectorUpdateBody;
  try {
    body = (await request.json()) as SectorUpdateBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = {
    id,
    name: typeof body.name === 'string' ? body.name : undefined,
    displayOrder: typeof body.displayOrder === 'number' ? body.displayOrder : undefined,
    workforceShare: typeof body.workforceShare === 'number' || body.workforceShare === null ? body.workforceShare : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  };

  if (!validateSectorUpdateInput(input)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Invalid sector update payload.' },
      { status: 400 },
    );
  }

  try {
    const sector = await updateSector(input);
    if (!sector) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Sector not found.' },
        { status: 404 },
      );
    }

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.sector.update',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { sectorId: id },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, sector }, { status: 200 });
  } catch (error) {
    reportError(error, {
      area: 'skills-taxonomy',
      op: 'update_sector',
      extra: { userId: gate.auth.userId, id },
    });

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.sector.update',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: { sectorId: id },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to update sector.' },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await context.params;

  let reason = new URL(request.url).searchParams.get('reason') ?? '';
  if (!reason) {
    try {
      const body = (await request.json()) as DeleteBody;
      reason = typeof body.reason === 'string' ? body.reason : '';
    } catch {
      reason = '';
    }
  }

  if (!validateDeleteInput('sector', id, reason)) {
    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload, message: 'Delete reason is required.' },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteTaxonomyTarget('sector', id, gate.auth.userId, reason);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.sector.delete',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'destructive_policy_passed',
      target: { sectorId: id },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, sectorId: id, deleted: true, deletedAt: deleted.deletedAtIso }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    const conflict = errorMessage === 'unresolved_downstream_dependencies' || errorMessage === 'destructive_threshold_exceeded';
    const notFound = errorMessage === 'sector_not_found';

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.sector.delete',
      actorId: gate.auth.userId,
      status: conflict || notFound ? 'deny' : 'allow',
      reason: conflict ? errorMessage : notFound ? 'sector_not_found' : 'admin_or_taxonomy_admin',
      target: { sectorId: id },
      result: 'failure',
      errorCategory: conflict ? 'dependency_conflict' : notFound ? 'not_found' : 'persistence_error',
    });

    if (notFound) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Sector not found.' },
        { status: 404 },
      );
    }

    if (conflict) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.conflict, message: 'Sector delete blocked by dependency safeguards.' },
        { status: 409 },
      );
    }

    reportError(error, {
      area: 'skills-taxonomy',
      op: 'delete_sector',
      extra: { userId: gate.auth.userId, id },
    });

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete sector.' },
      { status: 503 },
    );
  }
}
