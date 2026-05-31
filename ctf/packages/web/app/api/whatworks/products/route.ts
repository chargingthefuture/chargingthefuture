import { NextResponse } from 'next/server';
import { getProblemById, suggestProduct } from 'lib/whatworks/repository';
import { canSuggestProduct } from 'lib/whatworks/policy';
import {
  MAX_EMOJI_LENGTH,
  MAX_PRODUCT_KIND_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_PRODUCT_NOTE_LENGTH,
  MAX_PURCHASE_URL_LENGTH,
} from 'lib/whatworks/constants';
import {
  ensureMutationCsrf,
  isValidHttpUrl,
  parseJsonBody,
  readTrimmedString,
  requireWhatWorksAccess,
  whatworksError,
} from '../_lib';

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
    return whatworksError('You must be signed in to suggest an item.', 'whatworks_forbidden', 403);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return whatworksError('Invalid JSON body.', 'whatworks_invalid_body', 400);
  }

  const problemId = readTrimmedString(body.problemId);
  const name = readTrimmedString(body.name);
  const purchaseUrl = readTrimmedString(body.purchaseUrl);
  const emoji = readTrimmedString(body.emoji) ?? '';
  const kind = readTrimmedString(body.kind) ?? '';
  const note = readTrimmedString(body.note) ?? '';

  if (!problemId) {
    return whatworksError('Choose the problem this item solves.', 'whatworks_problem_required', 400);
  }
  if (!name) {
    return whatworksError('Add a product name.', 'whatworks_name_required', 400);
  }
  if (!purchaseUrl) {
    return whatworksError('Add a direct purchase link.', 'whatworks_link_required', 400);
  }
  if (name.length > MAX_PRODUCT_NAME_LENGTH) {
    return whatworksError('Product name is too long.', 'whatworks_name_too_long', 400);
  }
  if (kind.length > MAX_PRODUCT_KIND_LENGTH) {
    return whatworksError('Product type is too long.', 'whatworks_kind_too_long', 400);
  }
  if (note.length > MAX_PRODUCT_NOTE_LENGTH) {
    return whatworksError('Note is too long.', 'whatworks_note_too_long', 400);
  }
  if (emoji.length > MAX_EMOJI_LENGTH) {
    return whatworksError('Emoji is invalid.', 'whatworks_emoji_invalid', 400);
  }
  if (purchaseUrl.length > MAX_PURCHASE_URL_LENGTH || !isValidHttpUrl(purchaseUrl)) {
    return whatworksError('Enter a valid http(s) purchase link.', 'whatworks_link_invalid', 400);
  }

  const problem = await getProblemById(problemId);
  if (!problem || !problem.is_active) {
    return whatworksError('That problem could not be found.', 'whatworks_problem_not_found', 404);
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
    return NextResponse.json({ ok: true, productId: product.id, status: product.status }, { status: 201 });
  } catch (error) {
    console.error('whatworks: failed to save product suggestion', error);
    return whatworksError('We could not save your suggestion. Try again.', 'whatworks_suggest_failed', 500);
  }
}
