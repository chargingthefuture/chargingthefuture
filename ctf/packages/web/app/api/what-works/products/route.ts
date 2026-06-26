import { NextResponse } from 'next/server';
import { getProblemById, suggestProduct } from 'lib/what-works/repository';
import { canSuggestProduct } from 'lib/what-works/policy';
import {
  MAX_EMOJI_LENGTH,
  MAX_PRODUCT_KIND_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_PRODUCT_NOTE_LENGTH,
  MAX_PURCHASE_URL_LENGTH,
} from 'lib/what-works/constants';
import {
  ensureMutationCsrf,
  isValidHttpUrl,
  parseJsonBody,
  readTrimmedString,
  requireWhatWorksAccess,
  whatWorksError,
} from '../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';
import { reportError } from 'lib/observability/report';

// A survivor suggests a tool. It lands as `pending` for admin review before it joins
// the shared list, and the suggester is auto-recorded as its first verifier.
export async function POST(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) {
    return csrf;
  }
  const gate = await requireWhatWorksAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  if (!canSuggestProduct(gate.auth.userId)) {
    return whatWorksError('You must be signed in to suggest an item.', 'what_works_forbidden', 403);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return whatWorksError('Invalid JSON body.', 'what_works_invalid_body', 400);
  }

  const problemId = readTrimmedString(body.problemId);
  const name = readTrimmedString(body.name);
  const purchaseUrl = readTrimmedString(body.purchaseUrl);
  const emoji = readTrimmedString(body.emoji) ?? '';
  const kind = readTrimmedString(body.kind) ?? '';
  const note = readTrimmedString(body.note) ?? '';

  if (!problemId) {
    return whatWorksError('Choose the problem this item solves.', 'what_works_problem_required', 400);
  }
  if (!name) {
    return whatWorksError('Add a product name.', 'what_works_name_required', 400);
  }
  if (!purchaseUrl) {
    return whatWorksError('Add a direct purchase link.', 'what_works_link_required', 400);
  }
  if (name.length > MAX_PRODUCT_NAME_LENGTH) {
    return whatWorksError('Product name is too long.', 'what_works_name_too_long', 400);
  }
  if (kind.length > MAX_PRODUCT_KIND_LENGTH) {
    return whatWorksError('Product type is too long.', 'what_works_kind_too_long', 400);
  }
  if (note.length > MAX_PRODUCT_NOTE_LENGTH) {
    return whatWorksError('Note is too long.', 'what_works_note_too_long', 400);
  }
  if (emoji.length > MAX_EMOJI_LENGTH) {
    return whatWorksError('Emoji is invalid.', 'what_works_emoji_invalid', 400);
  }
  if (purchaseUrl.length > MAX_PURCHASE_URL_LENGTH || !isValidHttpUrl(purchaseUrl)) {
    return whatWorksError('Enter a valid http(s) purchase link.', 'what_works_link_invalid', 400);
  }

  const problem = await getProblemById(problemId);
  if (!problem || !problem.is_active) {
    return whatWorksError('That problem could not be found.', 'what_works_problem_not_found', 404);
  }

  try {
    const product = await suggestProduct({
      problemId,
      name,
      purchaseUrl,
      emoji,
      kind,
      note,
      suggestedBy: gate.auth.userId,
    });
    logWhatWorksAudit({
      actorId: gate.auth.userId,
      command: 'what-works.product.suggest',
      status: 'allow',
      reason: 'access_route_guard',
      targetType: 'product',
      targetId: product.id,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, productId: product.id, status: product.status }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'products' });
    console.error('what-works: failed to save product suggestion', error);
    return whatWorksError('We could not save your suggestion. Try again.', 'what_works_suggest_failed', 500);
  }
}
