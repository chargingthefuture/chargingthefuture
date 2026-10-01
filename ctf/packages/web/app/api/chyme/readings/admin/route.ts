import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getReadingsSetting, setReadingsEnabled } from 'lib/chyme/readings/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { ensureMutationCsrf, requireChymeAdminAccess } from '../../_lib';
import { invalid, readJsonBody, recordReadingsAudit } from '../_lib';

export const dynamic = 'force-dynamic';

// GET /api/chyme/readings/admin — the switch, for /admin/chyme/readings. The playlist is the blog's
// list, which the admin screen reads directly.
export async function GET() {
  const gate = await requireChymeAdminAccess();
  if (!gate.allowed) return gate.response;
  try {
    const setting = await getReadingsSetting();
    return NextResponse.json({ ok: true, setting });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'readings_admin_read' });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Unable to read the readings switch: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

// POST /api/chyme/readings/admin  { enabled: boolean } — switch the loop on or off.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;
  const gate = await requireChymeAdminAccess();
  if (!gate.allowed) return gate.response;

  const body = await readJsonBody(request);
  if (typeof body.enabled !== 'boolean') return invalid('enabled must be true or false.');
  const enabled = body.enabled;
  const audit = { actorId: gate.auth.userId, command: 'chyme.admin.readings.switch' as const, targetType: 'chyme_readings_config', targetId: 'enabled', metadata: { enabled } };

  try {
    const setting = await setReadingsEnabled(gate.auth.userId, enabled);
    await recordReadingsAudit({ ...audit, ok: true });
    return NextResponse.json({ ok: true, setting });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'readings_admin_switch' });
    await recordReadingsAudit({ ...audit, ok: false });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Could not save the readings switch: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
