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

  const patch: UpdateProblemInput = {};
  const title = readTrimmedString(body.title);
  if (title !== null) {
    if (title.length > MAX_PROBLEM_TITLE_LENGTH) {
      return whatWorksError('Problem title is too long.', 'what_works_title_too_long', 400);
    }
    patch.title = title;
  }
  if (typeof body.context === 'string') {
    const context2 = body.context.trim();
    if (context2.length > MAX_PROBLEM_CONTEXT_LENGTH) {
      return whatWorksError('Problem context is too long.', 'what_works_context_too_long', 400);
    }
    patch.context = context2;
  }
  if (typeof body.emoji === 'string') {
    const emoji = body.emoji.trim();
    if (emoji.length > MAX_EMOJI_LENGTH) {
      return whatWorksError('Emoji is invalid.', 'what_works_emoji_invalid', 400);
    }
    patch.emoji = emoji;
  }
  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    patch.sortOrder = Math.trunc(body.sortOrder);
  }
  if (typeof body.isActive === 'boolean') {
    patch.isActive = body.isActive;
  }

  if (Object.keys(patch).length === 0) {
    return whatWorksError('No fields to update.', 'what_works_no_fields', 400);
  }

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
