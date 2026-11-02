import { NextResponse } from 'next/server';
import { bearerMatches } from 'lib/auth/internal-secret';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import {
  runStreamModerationSetup,
  setupPassed,
  type StreamSetupMode,
  type StreamSetupTarget,
} from 'lib/integrations/stream-moderation-setup';

// Cron-only: reads or applies the Stream moderation configs and chat auto-translation with the app's
// own Stream keys (lib/integrations/stream-moderation-setup.ts). Called by the
// stream-moderation-setup workflow with CRON_SECRET (Bearer). The answer carries no key, only what
// is short of the target and what was done.
const MODES: StreamSetupMode[] = ['plan', 'check', 'apply'];
const TARGETS: StreamSetupTarget[] = ['production', 'staging', 'both'];

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) return false;
  return bearerMatches(request, cronSecret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, code: 'stream_setup_forbidden', message: 'Invalid cron secret.' }, { status: 403 });
  }
  const url = new URL(request.url);
  const mode = (url.searchParams.get('mode') ?? 'plan') as StreamSetupMode;
  const target = (url.searchParams.get('target') ?? 'production') as StreamSetupTarget;
  if (!MODES.includes(mode) || !TARGETS.includes(target)) {
    return NextResponse.json(
      { ok: false, code: 'stream_setup_invalid', message: `mode must be ${MODES.join('/')} and target ${TARGETS.join('/')}.` },
      { status: 400 },
    );
  }
  try {
    const apps = await runStreamModerationSetup(mode, target);
    return NextResponse.json({ ok: setupPassed(mode, apps), mode, target, apps }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'moderation', op: 'stream_setup' });
    return NextResponse.json(
      { ok: false, code: 'stream_setup_failed', message: `The Stream setup could not run: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
