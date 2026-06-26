import { NextResponse } from 'next/server';
import {
  addEndorsement,
  getProductById,
  getProductEndorsementState,
  removeEndorsement,
} from 'lib/whatworks/repository';
import { canEndorseProduct } from 'lib/whatworks/policy';
import {
  ensureMutationCsrf,
  requireWhatWorksAccess,
  whatworksError,
  type WhatWorksApiGate,
} from '../../../_lib';
import { logWhatWorksAudit } from 'lib/whatworks/audit';

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
      response: whatworksError('You must be signed in to mark an item helpful.', 'whatworks_forbidden', 403),
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
    return whatworksError('That item could not be found.', 'whatworks_product_not_found', 404);
  }
  await addEndorsement(id, auth.gate.auth.userId);
  const state = await getProductEndorsementState(id, auth.gate.auth.userId);
  logWhatWorksAudit({
    actorId: auth.gate.auth.userId,
    command: 'whatworks.product.endorse',
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
    return whatworksError('That item could not be found.', 'whatworks_product_not_found', 404);
  }
  await removeEndorsement(id, auth.gate.auth.userId);
  const state = await getProductEndorsementState(id, auth.gate.auth.userId);
  logWhatWorksAudit({
    actorId: auth.gate.auth.userId,
    command: 'whatworks.product.unendorse',
    status: 'allow',
    reason: 'access_route_guard',
    targetType: 'product',
    targetId: id,
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, ...state });
}
