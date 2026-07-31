import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireContributorAccessAdmin } from '../_lib';
import {
  countEligibleMembers,
  getContributorAccessConfig,
  insertContributorAccessAudit,
  upsertContributorAccessConfig,
} from 'lib/contributor-access/repository';
import {
  ensureGatedChannel,
  getGatedChannelMemberCount,
  syncGatedChannelMembership,
} from 'lib/contributor-access/gated-channel';
import { CONTRIBUTOR_VALUE_EVENT_KEYS } from 'lib/contributor-access/weights';
import { reportError } from 'lib/observability/report';

// Admin read/update of the single owner-tunable config row (weights, threshold, gate minimums,
// channel_open). Admin-only; every allow/deny audits. The channel_open launch gate is enforced
// HERE, server-side: it can only turn on once the eligible count meets
// min_eligible_to_open_channel; flipping it on creates the gated Stream channel and runs the
// first membership sync.

export async function GET() {
  const gate = await requireContributorAccessAdmin('contributor-access.config.get');
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const config = await getContributorAccessConfig();
    // Best-effort synced member count for the status card (null when Stream is unconfigured or
    // the channel is not open yet).
    const channelMemberCount = config.channelOpen ? await getGatedChannelMemberCount() : null;
    await insertContributorAccessAudit({
      actorId: gate.auth.userId,
      command: 'contributor-access.config.get',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'config',
      targetId: 'singleton',
    });
    return NextResponse.json({ ok: true, config, channelMemberCount }, { status: 200 });
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

type ContributorAccessConfigInput = Parameters<typeof upsertContributorAccessConfig>[0];
type CurrentContributorAccessConfig = Awaited<ReturnType<typeof getContributorAccessConfig>>;

type NumericConfigFields = {
  threshold: number;
  minAccountAgeDays: number;
  minDistinctPlugins: number;
  minCounterparties: number;
  minEligibleToOpenChannel: number;
};

// Threshold and the four minimums: each defaults to the current value and must be a non-negative
// number. Returns null when any one is invalid so the caller can emit a single 400.
function parseNumericConfigFields(
  body: ConfigBody,
  current: CurrentContributorAccessConfig,
): NumericConfigFields | null {
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
    return null;
  }
  return { threshold, minAccountAgeDays, minDistinctPlugins, minCounterparties, minEligibleToOpenChannel };
}

// Validate the incoming config body against the current row and produce the update to persist, or a
// 400 response describing the first problem. Keeps the caller's TypeScript narrowing via destructuring.
function validateConfigUpdate(
  body: ConfigBody,
  current: CurrentContributorAccessConfig,
): { error: NextResponse } | { update: ContributorAccessConfigInput } {
  const weights = parseWeights(body.weights);
  if (weights === null) {
    return { error: invalidPayload('weights must map known value-event keys to non-negative numbers.') };
  }
  const numeric = parseNumericConfigFields(body, current);
  if (numeric === null) {
    return { error: invalidPayload('threshold and minimums must be non-negative numbers.') };
  }
  if (body.channelOpen !== undefined && typeof body.channelOpen !== 'boolean') {
    return { error: invalidPayload('channelOpen must be a boolean.') };
  }

  const update: ContributorAccessConfigInput = {
    weights: body.weights === undefined ? current.weights : weights,
    threshold: numeric.threshold,
    minAccountAgeDays: Math.floor(numeric.minAccountAgeDays),
    minDistinctPlugins: Math.floor(numeric.minDistinctPlugins),
    minCounterparties: Math.floor(numeric.minCounterparties),
    minEligibleToOpenChannel: Math.floor(numeric.minEligibleToOpenChannel),
    channelOpen: body.channelOpen ?? current.channelOpen,
  };
  return { update };
}

// Launch gate (server-side, never client-trusted): the channel can only turn on once enough
// members are eligible — a cold, near-empty "trusted" room reads worse than none. Checked
// against the minimum in this same update. Stable reason code for the shell. Returns the 409
// deny response (and audits it) when the gate blocks, otherwise null.
async function maybeEnforceLaunchGate(
  opening: boolean,
  update: ContributorAccessConfigInput,
  actorId: string,
): Promise<NextResponse | null> {
  if (!opening) {
    return null;
  }
  const eligibleCount = await countEligibleMembers();
  if (eligibleCount < update.minEligibleToOpenChannel) {
    await insertContributorAccessAudit({
      actorId,
      command: 'contributor-access.config.update',
      policyStatus: 'deny',
      reason: 'contributor_access_channel_below_minimum',
      targetType: 'config',
      targetId: 'singleton',
      metadata: { eligibleCount, minEligibleToOpenChannel: update.minEligibleToOpenChannel },
    });
    return NextResponse.json(
      {
        ok: false,
        code: 'contributor_access_channel_below_minimum',
        message: `The channel opens at ${update.minEligibleToOpenChannel} eligible members; there are ${eligibleCount}.`,
      },
      { status: 409 },
    );
  }
  return null;
}

// Opening the channel creates it in Stream and runs the first membership sync. Guarded: a
// Stream failure never rolls the config back — the flip already landed, membership
// reconciles on the next sync, and the admin sees the warning. Returns the warning to surface,
// or undefined when nothing needs surfacing (or the channel is not opening).
async function runChannelOpenSyncIfOpening(opening: boolean): Promise<string | undefined> {
  if (!opening) {
    return undefined;
  }
  try {
    const configured = await ensureGatedChannel();
    if (configured) {
      await syncGatedChannelMembership();
    } else {
      return 'Stream is not configured in this environment; the channel exists in config only.';
    }
  } catch (syncError) {
    reportError(syncError, { area: 'contributor-access', op: 'admin_config_channel_open_sync' });
    return 'Gated channel membership sync failed; it reconciles on the next sync.';
  }
  return undefined;
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
    const validated = validateConfigUpdate(body, current);
    if ('error' in validated) {
      return validated.error;
    }
    const { update } = validated;

    const opening = update.channelOpen && !current.channelOpen;
    const launchGateResponse = await maybeEnforceLaunchGate(opening, update, gate.auth.userId);
    if (launchGateResponse) {
      return launchGateResponse;
    }

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

    const channelSyncWarning = await runChannelOpenSyncIfOpening(opening);

    const config = await getContributorAccessConfig();
    return NextResponse.json(
      { ok: true, config, ...(channelSyncWarning ? { channelSyncWarning } : {}) },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'admin_config_update' });
    return NextResponse.json(
      { ok: false, code: 'contributor_access_unavailable', message: 'Config update unavailable.' },
      { status: 503 },
    );
  }
}
