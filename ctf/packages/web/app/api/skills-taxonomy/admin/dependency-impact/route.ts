import { NextResponse } from 'next/server';
import { requireTaxonomyAdminAccess } from '../../_lib';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { logSkillsTaxonomyAudit } from 'lib/skills-taxonomy/audit';
import { previewDependencyImpact, validateDependencyPreviewInput } from 'lib/skills-taxonomy/repository';
import { reportError } from 'lib/observability/report';

// The dependency-impact contract requires an `operation` input describing the
// destructive change being previewed. The repository preview is the same for
// both, but the operation is recorded in the audit targetContext per contract.
const VALID_OPERATIONS = new Set(['delete', 'deactivate']);

export async function GET(request: Request) {
  const gate = await requireTaxonomyAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const targetType = url.searchParams.get('targetType') ?? '';
  const targetId = url.searchParams.get('targetId') ?? '';
  const operation = url.searchParams.get('operation') ?? '';

  if (!validateDependencyPreviewInput(targetType, targetId) || !VALID_OPERATIONS.has(operation)) {
    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.invalidPayload,
        message: 'Invalid dependency targetType/targetId/operation.',
      },
      { status: 400 },
    );
  }

  try {
    const impact = await previewDependencyImpact(targetType, targetId);

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.dependency-impact.preview',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin_or_taxonomy_admin',
      target: {
        targetType,
        targetId,
        operation,
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(impact, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-taxonomy', op: 'admin_dependency_impact' });
    const errorMessage = error instanceof Error ? error.message : 'unknown_error';
    const notFound = errorMessage.endsWith('_not_found');

    logSkillsTaxonomyAudit({
      pluginId: 'skills-taxonomy',
      command: 'skills-taxonomy.dependency-impact.preview',
      actorId: gate.auth.userId,
      // A missing target is a denial-of-operation (invalid_target), not an
      // allowed-but-failed read, so the audit reflects a deny decision.
      status: notFound ? 'deny' : 'allow',
      reason: notFound ? 'invalid_target' : 'admin_or_taxonomy_admin',
      target: {
        targetType,
        targetId,
        operation,
      },
      result: 'failure',
      errorCategory: notFound ? 'not_found' : 'persistence_error',
    });

    if (notFound) {
      return NextResponse.json(
        { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.notFound, message: 'Taxonomy target not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: false, code: SKILLS_TAXONOMY_ERROR_CODE.persistenceUnavailable, message: 'Unable to preview dependency impact.' },
      { status: 503 },
    );
  }
}
