import { NextResponse } from 'next/server';
import { deleteProblem, getProblemById, updateProblem } from 'lib/what-works/repository';
import { MAX_EMOJI_LENGTH, MAX_PROBLEM_CONTEXT_LENGTH, MAX_PROBLEM_TITLE_LENGTH } from 'lib/what-works/constants';
import type { UpdateProblemInput } from 'lib/what-works/types';
import {
  ensureMutationCsrf,
  parseJsonBody,
  readTrimmedString,
  requireWhatWorksAdminAccess,
  whatWorksError,
} from '../../../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';

type RouteContext = { params: Promise<{ id: string }> };

// Read a finite number as a truncated integer, mirroring the original inline check; anything else
// yields null so the caller can skip the field.
function readFiniteInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return null;
}

// Build the partial update from the body, validating each supplied field's length. Returns the
// narrowed patch on success (guaranteed to hold at least one field), or an error response.
function buildProblemPatch(
  body: Record<string, unknown>,
): { error: NextResponse } | { data: UpdateProblemInput } {
  const patch: UpdateProblemInput = {};
  const title = readTrimmedString(body.title);
  if (title !== null) {
    if (title.length > MAX_PROBLEM_TITLE_LENGTH) {
      return { error: whatWorksError('Problem title is too long.', 'what_works_title_too_long', 400) };
    }
    patch.title = title;
  }
  if (typeof body.context === 'string') {
    const context2 = body.context.trim();
    if (context2.length > MAX_PROBLEM_CONTEXT_LENGTH) {
      return { error: whatWorksError('Problem context is too long.', 'what_works_context_too_long', 400) };
    }
    patch.context = context2;
  }
  if (typeof body.emoji === 'string') {
    const emoji = body.emoji.trim();
    if (emoji.length > MAX_EMOJI_LENGTH) {
      return { error: whatWorksError('Emoji is invalid.', 'what_works_emoji_invalid', 400) };
    }
    patch.emoji = emoji;
  }
  const sortOrder = readFiniteInt(body.sortOrder);
  if (sortOrder !== null) {
    patch.sortOrder = sortOrder;
  }
  if (typeof body.isActive === 'boolean') {
    patch.isActive = body.isActive;
  }

  if (Object.keys(patch).length === 0) {
    return { error: whatWorksError('No fields to update.', 'what_works_no_fields', 400) };
  }

  return { data: patch };
}

export async function PATCH(request: Request, context: RouteContext) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) {
    return csrf;
  }
  const gate = await requireWhatWorksAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const { id } = await context.params;
  const existing = await getProblemById(id);
  if (!existing) {
    return whatWorksError('That problem could not be found.', 'what_works_problem_not_found', 404);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return whatWorksError('Invalid JSON body.', 'what_works_invalid_body', 400);
  }

  const built = buildProblemPatch(body);
  if ('error' in built) {
    return built.error;
  }
  const patch = built.data;

  const problem = await updateProblem(id, patch);
  logWhatWorksAudit({
    actorId: gate.auth.userId,
    command: 'what-works.admin.problem.update',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'problem',
    targetId: id,
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, problem });
}

export async function DELETE(request: Request, context: RouteContext) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) {
    return csrf;
  }
  const gate = await requireWhatWorksAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const { id } = await context.params;
  const existing = await getProblemById(id);
  if (!existing) {
    return whatWorksError('That problem could not be found.', 'what_works_problem_not_found', 404);
  }
  await deleteProblem(id);
  logWhatWorksAudit({
    actorId: gate.auth.userId,
    command: 'what-works.admin.problem.delete',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'problem',
    targetId: id,
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true });
}
