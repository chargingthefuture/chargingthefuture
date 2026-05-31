import { NextResponse } from 'next/server';
import { deleteProblem, getProblemById, updateProblem } from 'lib/whatworks/repository';
import { MAX_EMOJI_LENGTH, MAX_PROBLEM_CONTEXT_LENGTH, MAX_PROBLEM_TITLE_LENGTH } from 'lib/whatworks/constants';
import type { UpdateProblemInput } from 'lib/whatworks/types';
import {
  ensureMutationCsrf,
  parseJsonBody,
  readTrimmedString,
  requireWhatWorksAdminAccess,
  whatworksError,
} from '../../../_lib';

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
    return whatworksError('That problem could not be found.', 'whatworks_problem_not_found', 404);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return whatworksError('Invalid JSON body.', 'whatworks_invalid_body', 400);
  }

  const patch: UpdateProblemInput = {};
  const title = readTrimmedString(body.title);
  if (title !== null) {
    if (title.length > MAX_PROBLEM_TITLE_LENGTH) {
      return whatworksError('Problem title is too long.', 'whatworks_title_too_long', 400);
    }
    patch.title = title;
  }
  if (typeof body.context === 'string') {
    const context2 = body.context.trim();
    if (context2.length > MAX_PROBLEM_CONTEXT_LENGTH) {
      return whatworksError('Problem context is too long.', 'whatworks_context_too_long', 400);
    }
    patch.context = context2;
  }
  if (typeof body.emoji === 'string') {
    const emoji = body.emoji.trim();
    if (emoji.length > MAX_EMOJI_LENGTH) {
      return whatworksError('Emoji is invalid.', 'whatworks_emoji_invalid', 400);
    }
    patch.emoji = emoji;
  }
  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    patch.sortOrder = Math.trunc(body.sortOrder);
  }
  if (typeof body.isActive === 'boolean') {
    patch.isActive = body.isActive;
  }

  const problem = await updateProblem(id, patch);
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
    return whatworksError('That problem could not be found.', 'whatworks_problem_not_found', 404);
  }
  await deleteProblem(id);
  return NextResponse.json({ ok: true });
}
