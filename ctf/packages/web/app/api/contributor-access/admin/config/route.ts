import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireContributorAccessAdmin } from '../_lib';
import {
  getContributorAccessConfig,
  insertContributorAccessAudit,
  upsertContributorAccessConfig,
} from 'lib/contributor-access/repository';
import { CONTRIBUTOR_VALUE_EVENT_KEYS } from 'lib/contributor-access/weights';
import { reportError } from 'lib/observability/report';

// Admin read/update of the single owner-tunable config row (weights, threshold, gate minimums,
// channel_open). Admin-only; every allow/deny audits.

export async function GET() {
  const gate = await requireContributorAccessAdmin('contributor-access.config.get');
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const config = await getContributorAccessConfig();
    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: 'contributor-access.config.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'config',
      targetId: 'singleton',
    });
    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_config_get' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: 'Config unavailable.' },
      { status: 503 },
    );
  }
}

type ConfigBody = {
  weights?: Record<string, unknown>;
  threshold?: number;
  minAccountAgeDays?: number;
  minDistinctPlugins?: number;
  minCounterparties?: number;
  minEligibleToOpenChannel?: number;
  channelOpen?: boolean;
};

function invalidPayload(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: 'contributor_access_invalid_payload', message }, { status: 400 });
}

// Weight overrides may only name the fixed value-event keys, with finite non-negative numbers.
function parseWeights(raw: Record<string, unknown> | undefined): Record<string, number> | null {
  if (raw == null) return {};
  const allowed = new Set<string>(CONTRIBUTOR_VALUE_EVENT_KEYS);
  const weights: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    weights[key] = value;
  }
  return weights;
}

function nonNegativeNumber(value: number | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export async function PUT(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireContributorAccessAdmin('contributor-access.config.update');
  if (!gate.allowed) {
    return gate.response;
  }

  let body: ConfigBody;
  try {
    body = (await request.json()) as ConfigBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: 'contributor_access_invalid_json', message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  try {
    const current = await getContributorAccessConfig();
    const weights = parseWeights(body.weights);
    if (weights === null) {
      return invalidPayload('weights must map known value-event keys to non-negative numbers.');
    }
    const threshold = nonNegativeNumber(body.threshold, current.threshold);
    const minAccountAgeDays = nonNegativeNumber(body.minAccountAgeDays, current.minAccountAgeDays);
    const minDistinctPlugins = nonNegativeNumber(body.minDistinctPlugins, current.minDistinctPlugins);
    const minCounterparties = nonNegativeNumber(body.minCounterparties, current.minCounterparties);
    const minEligibleToOpenChannel = nonNegativeNumber(body.minEligibleToOpenChannel, current.minEligibleToOpenChannel);
    if (
      threshold === null ||
      minAccountAgeDays === null ||
      minDistinctPlugins === null ||
      minCounterparties === null ||
      minEligibleToOpenChannel === null
    ) {
      return invalidPayload('threshold and minimums must be non-negative numbers.');
    }
    if (body.channelOpen !== undefined && typeof body.channelOpen !== 'boolean') {
      return invalidPayload('channelOpen must be a boolean.');
    }

    const update = {
      weights: body.weights === undefined ? current.weights : weights,
      threshold,
      minAccountAgeDays: Math.floor(minAccountAgeDays),
      minDistinctPlugins: Math.floor(minDistinctPlugins),
      minCounterparties: Math.floor(minCounterparties),
      minEligibleToOpenChannel: Math.floor(minEligibleToOpenChannel),
      channelOpen: body.channelOpen ?? current.channelOpen,
    };
    await upsertContributorAccessConfig(update);

    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: 'contributor-access.config.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'config',
      targetId: 'singleton',
      metadata: update,
    });

    const config = await getContributorAccessConfig();
    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_config_update' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: 'Config update unavailable.' },
      { status: 503 },
    );
  }
}
