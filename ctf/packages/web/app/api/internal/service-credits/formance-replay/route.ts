import { NextResponse } from 'next/server';
import { replayQueuedFormancePosts } from 'lib/service-credits/formance-replay';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { secretsMatch } from 'lib/auth/internal-secret';

export const dynamic = 'force-dynamic';

// Re-send the ServiceCredits ledger posts Formance did not take (issue #2907). Called hourly by
// .github/workflows/service-credits-formance-replay.yml with the same internal token the deletion
// reclaim route checks. Answers counts only: no member id or amount leaves this route.
function authorize(request: Request): NextResponse | null {
  const configuredToken = process.env.SERVICE_CREDITS_INTERNAL_TOKEN?.trim() ?? '';
  if (configuredToken.length === 0) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_internal_not_configured', message: 'SERVICE_CREDITS_INTERNAL_TOKEN is not set in the app runtime.' },
      { status: 503 },
    );
  }
  const providedToken = request.headers.get('x-service-credits-internal-token') ?? '';
  if (!secretsMatch(providedToken, configuredToken)) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_internal_token', message: 'Invalid ServiceCredits internal token.' },
      { status: 403 },
    );
  }
  return null;
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const result = await replayQueuedFormancePosts();
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'formance_replay_run' });
    return NextResponse.json(
      { ok: false, code: 'service_credits_formance_replay_failed', message: `The Formance replay could not run: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
