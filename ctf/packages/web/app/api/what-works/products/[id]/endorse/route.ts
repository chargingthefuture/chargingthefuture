import { NextResponse } from 'next/server';
import {
  addEndorsement,
  getProductById,
  getProductEndorsementState,
  removeEndorsement,
} from 'lib/what-works/repository';
import { canEndorseProduct } from 'lib/what-works/policy';
import {
  ensureMutationCsrf,
  requireWhatWorksAccess,
  whatWorksError,
  type WhatWorksApiGate,
} from '../../../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';

type RouteContext = { params: Promise<{ id: string }> };

async function authorizeEndorsement(request: Request): Promise<
  | { ok: true; gate: Extract<WhatWorksApiGate, { allowed: true }> }
  | { ok: false; response: NextResponse }
> {
  const csrf = ensureMutationCsrf(request);
  if (csrf) {
    return { ok: false, response: csrf };
  }
  const gate = await requireWhatWorksAccess();
  if (!gate.allowed) {
    return { ok: false, response: gate.response };
  }
  if (!canEndorseProduct(gate.auth.userId)) {
    return {
      ok: false,
      response: whatWorksError('You must be signed in to mark an item helpful.', 'what_works_forbidden', 403),
    };
  }
  return { ok: true, gate };
}

// "Helpful" — the survivor is saying this tool helped them too; the count of these
// endorsements is what renders as "N survivors verified".
export async function POST(request: Request, context: RouteContext) {
  const auth = await authorizeEndorsement(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { id } = await context.params;
  const product = await getProductById(id);
  if (!product || product.status !== 'approved') {
    return whatWorksError('That item could not be found.', 'what_works_product_not_found', 404);
  }
  await addEndorsement(id, auth.gate.auth.userId);
  const state = await getProductEndorsementState(id, auth.gate.auth.userId);
  logWhatWorksAudit({
    actorId: auth.gate.auth.userId,
    command: 'what-works.product.endorse',
    status: 'allow',
    reason: 'access_route_guard',
    targetType: 'product',
    targetId: id,
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, ...state });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authorizeEndorsement(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { id } = await context.params;
  const product = await getProductById(id);
  if (!product || product.status !== 'approved') {
    return whatWorksError('That item could not be found.', 'what_works_product_not_found', 404);
  }
  await removeEndorsement(id, auth.gate.auth.userId);
  const state = await getProductEndorsementState(id, auth.gate.auth.userId);
  logWhatWorksAudit({
    actorId: auth.gate.auth.userId,
    command: 'what-works.product.unendorse',
    status: 'allow',
    reason: 'access_route_guard',
    targetType: 'product',
    targetId: id,
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, ...state });
}
