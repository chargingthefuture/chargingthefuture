import { NextResponse } from 'next/server';
import { deleteProduct, getProductById, reviewProduct } from 'lib/what-works/repository';
import { MAX_PRODUCT_NOTE_LENGTH } from 'lib/what-works/constants';
import {
  ensureMutationCsrf,
  parseJsonBody,
  readTrimmedString,
  requireWhatWorksAdminAccess,
  whatWorksError,
} from '../../../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';

type RouteContext = { params: Promise<{ id: string }> };

// Approve or reject a suggested tool.
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
  if (action !== 'approve' && action !== 'reject') {
    return whatWorksError('Action must be approve or reject.', 'what_works_invalid_action', 400);
  }
  const rejectionReason = readTrimmedString(body.rejectionReason) ?? undefined;
  if (rejectionReason && rejectionReason.length > MAX_PRODUCT_NOTE_LENGTH) {
    return whatWorksError('Rejection reason is too long.', 'what_works_reason_too_long', 400);
  }

  const product = await reviewProduct(id, {
    action,
    reviewerId: gate.auth.userId,
    rejectionReason,
  });
  logWhatWorksAudit({
    actorId: gate.auth.userId,
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
