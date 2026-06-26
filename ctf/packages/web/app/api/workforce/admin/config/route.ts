import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireWorkforceAdminAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { insertWorkforceAdminAudit, getWorkforceConfig, updateWorkforceConfig, validateConfigInput } from 'lib/workforce/repository';
import { logWorkforceAudit, WORKFORCE_AUDIT_WORKSPACE } from 'lib/workforce/audit';
import type { WorkforceConfigInput } from 'lib/workforce/types';
import { reportError } from 'lib/observability/report';

type ConfigBody = Partial<WorkforceConfigInput>;

function toConfigInput(body: ConfigBody): WorkforceConfigInput {
  return {
    population: typeof body.population === 'number' ? body.population : Number.NaN,
    participationRate: typeof body.participationRate === 'number' ? body.participationRate : Number.NaN,
    minRecruitable: typeof body.minRecruitable === 'number' ? body.minRecruitable : Number.NaN,
    maxRecruitable: typeof body.maxRecruitable === 'number' ? body.maxRecruitable : Number.NaN,
  };
}

export async function GET() {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const config = await getWorkforceConfig();
    return NextResponse.json({ config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_config' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch workforce config.' },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const gate = await requireWorkforceAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: ConfigBody;
  try {
    body = (await request.json()) as ConfigBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = toConfigInput(body);
  if (!validateConfigInput(input)) {
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.invalidPayload, message: 'Invalid config payload.' },
      { status: 400 },
    );
  }

  const requestId = request.headers.get('x-request-id');
  const traceId = request.headers.get('x-trace-id');

  try {
    const config = await updateWorkforceConfig(gate.auth.userId, input);
    // The config row has no separate version column; its updatedAtIso is the monotonic version stamp.
    const configVersion = config.updatedAtIso;

    await insertWorkforceAdminAudit({
      actorId: gate.auth.userId,
      command: 'workforce.admin.config.update',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'config',
      targetId: 'workforce',
      metadata: {
        workspaceId: WORKFORCE_AUDIT_WORKSPACE,
        configVersion,
        population: config.population,
        participationRate: config.participationRate,
        minRecruitable: config.minRecruitable,
        maxRecruitable: config.maxRecruitable,
      },
    });

    logWorkforceAudit({
      actorId: gate.auth.userId,
      command: 'workforce.admin.config.update',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'config',
      targetId: 'workforce',
      result: 'success',
      errorCategory: null,
      requestId,
      traceId,
      targetContext: {
        workspaceId: WORKFORCE_AUDIT_WORKSPACE,
        configVersion,
      },
    });

    // Contract output schema is { config, updatedAt }; expose updatedAt at the top level too (it also
    // lives on config.updatedAtIso) so a contract-driven consumer doesn't read undefined.
    return NextResponse.json({ ok: true, config, updatedAt: config.updatedAtIso }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'admin_config' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to update config.' },
      { status: 503 },
    );
  }
}
