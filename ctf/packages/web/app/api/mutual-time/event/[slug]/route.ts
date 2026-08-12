import { NextResponse } from 'next/server';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { getPublicEvent, getViewerPicks } from 'lib/mutual-time/repository';
import { resolveRequestIdentity } from 'lib/auth/request-identity';
import { getUnlockAccessTier } from 'lib/unlock/access';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';

// GET /api/mutual-time/event/[slug] — PUBLIC read of one event by its shareable slug. Anyone (even
// signed-out) may read the event's public fields (title/description/status/result). If the caller is a
// signed-in, Unlock-approved member, the response also carries `viewer.canVote = true` and their current
// picks so the vote UI can hydrate. Never exposes who else voted or their picks. Rate-limited for abuse.
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const limited = enforcePublicReadRateLimit(request, 'mutual-time-public-event');
  if (limited) {
    return limited;
  }

  const { slug } = await context.params;
  try {
    const event = await getPublicEvent(slug);
    if (!event) {
      return NextResponse.json(
        { ok: false, code: MUTUAL_TIME_ERROR_CODE.notFound, message: 'Event not found.' },
        { status: 404 },
      );
    }

    // Optionally enrich with the viewer's own vote state — without collapsing to allow/deny.
    const identity = await resolveRequestIdentity().catch(() => null);
    const userId = identity?.isAuthenticated ? identity.userId : null;
    let canVote = false;
    let picks: string[] = [];
    let expiredPicks = 0;
    if (userId) {
      const tier = await getUnlockAccessTier(userId).catch(() => null);
      canVote = tier === 'approved_full' || Boolean(identity?.isAdmin);
      const viewerPicks = await getViewerPicks(slug, userId).catch(() => ({ picks: [], expiredCount: 0 }));
      picks = viewerPicks.picks;
      expiredPicks = viewerPicks.expiredCount;
    }

    return NextResponse.json({ ok: true, event, viewer: { canVote, picks, expiredPicks } }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'mutual-time', op: 'public_event', extra: { slug } });
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.persistenceUnavailable, message: 'Unable to load the event.' },
      { status: 503 },
    );
  }
}
