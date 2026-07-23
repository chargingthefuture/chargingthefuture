import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { markAdminAreaSeen } from 'lib/admin/area-attention';
import { reportError } from 'lib/observability/report';

type AreaSeenBody = { areaSlug?: string };

function csrfDeny(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json({ ok: false, code: 'csrf_denied', message: 'Missing CSRF confirmation header.' }, { status: 403 });
  }
  if (checkMutationOrigin(request) !== 'allow') {
    return NextResponse.json({ ok: false, code: 'csrf_denied', message: 'Cross-origin mutation denied.' }, { status: 403 });
  }
  return null;
}

// Admin-only: mark an admin area opened by the calling admin, which clears that area's "new to review"
// dot on the landing tiles. Scoped to the caller (the marker is per-admin). A slug with no review
// queue is accepted and ignored, so the client can call this for any tile it opens.
export async function POST(request: Request) {
  const deny = csrfDeny(request);
  if (deny) {
    return deny;
  }

  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  let body: AreaSeenBody;
  try {
    body = (await request.json()) as AreaSeenBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  const areaSlug = typeof body.areaSlug === 'string' ? body.areaSlug.trim() : '';
  if (!areaSlug) {
    return NextResponse.json({ ok: false, code: 'invalid_payload', message: 'areaSlug is required.' }, { status: 400 });
  }

  try {
    await markAdminAreaSeen(decision.userId, areaSlug);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'admin-attention', op: 'mark_seen' });
    return NextResponse.json({ ok: false, code: 'admin_area_seen_error', message: 'Could not update the marker.' }, { status: 500 });
  }
}
