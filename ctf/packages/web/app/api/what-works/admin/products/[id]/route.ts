import { NextResponse } from 'next/server';
import { deleteProduct, getProductById, reviewProduct, updateProduct } from 'lib/what-works/repository';
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
  requireWhatWorksAdminAccess,
  whatWorksError,
} from '../../../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';

type RouteContext = { params: Promise<{ id: string }> };

// The editable tool fields once required-field and length checks have passed.
type ValidatedProductEdit = {
  name: string;
  purchaseUrl: string;
  emoji: string;
  kind: string;
  note: string;
};

// Optional fields keep the original semantics: a string value is trimmed, anything else is ''.
function readTrimmedOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Validate the edit body. Returns the narrowed fields on success so the caller keeps type
// narrowing, or an error response to return as-is.
function validateProductEdit(
  body: Record<string, unknown>,
): { error: NextResponse } | { data: ValidatedProductEdit } {
  const name = readTrimmedString(body.name);
  const purchaseUrl = readTrimmedString(body.purchaseUrl);
  const emoji = readTrimmedOrEmpty(body.emoji);
  const kind = readTrimmedOrEmpty(body.kind);
  const note = readTrimmedOrEmpty(body.note);

  if (!name) {
    return { error: whatWorksError('Add a product name.', 'what_works_name_required', 400) };
  }
  if (!purchaseUrl) {
    return { error: whatWorksError('Add a direct purchase link.', 'what_works_link_required', 400) };
  }
  if (name.length > MAX_PRODUCT_NAME_LENGTH) {
    return { error: whatWorksError('Product name is too long.', 'what_works_name_too_long', 400) };
  }
  if (kind.length > MAX_PRODUCT_KIND_LENGTH) {
    return { error: whatWorksError('Product type is too long.', 'what_works_kind_too_long', 400) };
  }
  if (note.length > MAX_PRODUCT_NOTE_LENGTH) {
    return { error: whatWorksError('Note is too long.', 'what_works_note_too_long', 400) };
  }
  if (emoji.length > MAX_EMOJI_LENGTH) {
    return { error: whatWorksError('Emoji is invalid.', 'what_works_emoji_invalid', 400) };
  }
  if (purchaseUrl.length > MAX_PURCHASE_URL_LENGTH || !isValidHttpUrl(purchaseUrl)) {
    return { error: whatWorksError('Enter a valid http(s) purchase link.', 'what_works_link_invalid', 400) };
  }

  return { data: { name, purchaseUrl, emoji, kind, note } };
}

// No action → correct the tool's details.
// The edit path lets an admin fix a typo or a broken link after the tool is already approved,
// without unpublishing it. Identity columns and endorsements are never touched.
async function handleProductEdit(
  id: string,
  body: Record<string, unknown>,
  actorId: string,
): Promise<NextResponse> {
  const validated = validateProductEdit(body);
  if ('error' in validated) {
    return validated.error;
  }
  const { name, purchaseUrl, emoji, kind, note } = validated.data;

  const product = await updateProduct(id, { emoji, name, kind, note, purchaseUrl });
  logWhatWorksAudit({
    actorId,
    command: 'what-works.admin.product.update',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'product',
    targetId: id,
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, status: product?.status ?? null });
}

// Otherwise → moderate (approve/reject).
async function handleProductModeration(
  id: string,
  body: Record<string, unknown>,
  action: string,
  actorId: string,
): Promise<NextResponse> {
  if (action !== 'approve' && action !== 'reject') {
    return whatWorksError('Action must be approve or reject.', 'what_works_invalid_action', 400);
  }
  const rejectionReason = readTrimmedString(body.rejectionReason) ?? undefined;
  if (rejectionReason && rejectionReason.length > MAX_PRODUCT_NOTE_LENGTH) {
    return whatWorksError('Rejection reason is too long.', 'what_works_reason_too_long', 400);
  }

  const product = await reviewProduct(id, {
    action,
    reviewerId: actorId,
    rejectionReason,
  });
  logWhatWorksAudit({
    actorId,
    command: 'what-works.admin.product.review',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'product',
    targetId: id,
    result: 'success',
    errorCategory: null,
    metadata: { action, status: product?.status ?? null },
  });
  return NextResponse.json({ ok: true, status: product?.status ?? null });
}

// PATCH does one of two things depending on the body:
//   - `action: approve|reject`  → moderate the tool (change its status).
//   - no `action`               → correct the tool's own details (name, link, note, emoji, kind).
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
  const existing = await getProductById(id);
  if (!existing) {
    return whatWorksError('That item could not be found.', 'what_works_product_not_found', 404);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return whatWorksError('Invalid JSON body.', 'what_works_invalid_body', 400);
  }

  const action = readTrimmedString(body.action);
  if (action === null) {
    return handleProductEdit(id, body, gate.auth.userId);
  }
  return handleProductModeration(id, body, action, gate.auth.userId);
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
  const existing = await getProductById(id);
  if (!existing) {
    return whatWorksError('That item could not be found.', 'what_works_product_not_found', 404);
  }
  await deleteProduct(id);
  logWhatWorksAudit({
    actorId: gate.auth.userId,
    command: 'what-works.admin.product.delete',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'product',
    targetId: id,
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true });
}
