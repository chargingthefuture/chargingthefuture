import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { recordComicAdminAudit } from 'lib/comic/audit';
import { readEnginePower, readEnginePowerConfig, setEnginePower, type PowerFetch } from 'lib/chatbot/runpod-endpoint-power';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

const runpodFetch: PowerFetch = (input, init) => fetch(input, init);

// Admin-only: whether the drafting endpoint (the RunPod endpoint in OLLAMA_BASE_URL) is on, and a
// switch for it. On is 1 max worker, off is 0. RunPod turns an idle endpoint off by itself after
// about two weeks with no requests, and this is how the owner turns it back on from the phone.
export async function GET() {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const config = readEnginePowerConfig();
  if (!config.ok) {
    return NextResponse.json({ ok: true, available: false, reason: config.reason }, { status: 200 });
  }
  try {
    const power = await readEnginePower(config, runpodFetch);
    return NextResponse.json({ ok: true, available: true, ...power }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'engine_power_get' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.llmUnavailable, message: `Could not read whether the drafting endpoint is on: ${failureReason(error)}` },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const payload = (await request.json().catch(() => null)) as { on?: unknown } | null;
  if (typeof payload?.on !== 'boolean') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Say whether to turn the drafting endpoint on or off ({ "on": true } or { "on": false }).' },
      { status: 400 },
    );
  }
  const on = payload.on;

  const config = readEnginePowerConfig();
  if (!config.ok) {
    return NextResponse.json({ ok: false, code: COMIC_ERROR_CODE.llmUnavailable, message: config.reason }, { status: 409 });
  }

  try {
    const power = await setEnginePower(config, on, runpodFetch);
    await recordComicAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.engine.power.set',
      status: 'allow',
      reason: on ? 'turned_on' : 'turned_off',
      targetType: 'runpod_endpoint',
      targetId: config.endpointId,
      result: 'success',
      errorCategory: null,
      metadata: { workersMax: power.workersMax },
    });
    return NextResponse.json({ ok: true, available: true, ...power }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'engine_power_set' });
    const reason = failureReason(error);
    await recordComicAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.engine.power.set',
      status: 'allow',
      reason: on ? 'turn_on_failed' : 'turn_off_failed',
      targetType: 'runpod_endpoint',
      targetId: config.endpointId,
      result: 'failure',
      errorCategory: 'upstream_unavailable',
      metadata: { failureReason: reason },
    });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.llmUnavailable, message: `Could not turn the drafting endpoint ${on ? 'on' : 'off'}: ${reason}` },
      { status: 502 },
    );
  }
}
