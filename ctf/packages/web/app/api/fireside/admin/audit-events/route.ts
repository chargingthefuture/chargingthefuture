import { NextResponse } from 'next/server';
import { requireFiresideAdmin } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { listFiresideAuditEvents } from 'lib/fireside/repository';
import { failureResponse } from 'lib/errors/failure';

/**
 * The audit trail, newest first.
 *
 * Every write in this plugin has recorded a row since it shipped, and until now nothing could read
 * one back. The powers on the admin screen are removing somebody's words and agreeing to copy them
 * onto a page a web archive keeps forever; a record of who did that, which nobody can read, is not
 * a check on anything (rule 131).
 *
 * A read, so it writes no row of its own — the actions it shows are each recorded where they happen.
 */
export async function GET(request: Request) {
  const gate = await requireFiresideAdmin();
  if (!gate.allowed) return gate.response;

  const raw = Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '200', 10);
  const limit = Number.isFinite(raw) ? raw : 200;

  try {
    // The repository clamps the limit; the route does not have to repeat the bound in a second place.
    const events = await listFiresideAuditEvents(limit);
    return NextResponse.json({ ok: true, events }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to load the audit trail',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'admin_audit_events',
      status: 503,
      audience: 'operator',
    });
  }
}
