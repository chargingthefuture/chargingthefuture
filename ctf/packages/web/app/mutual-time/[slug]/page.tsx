import { notFound } from 'next/navigation';
import { resolveRequestIdentity } from 'lib/auth/request-identity';
import { getUnlockAccessTier } from 'lib/unlock/access';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { getPublicEvent, getViewerPicks } from 'lib/mutual-time/repository';
import { MutualTimePublic } from '@/components/mutual-time/mutual-time-public';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// /mutual-time/[slug] — the one shareable, PUBLIC link for a Mutual Time event. Anyone (even signed-out)
// can open it: they see the event and either the result, a vote grid (approved members), or a
// sign-in/listen-in gate. Three viewer states are detected here from identity + Unlock tier, without
// collapsing to allow/deny (so a signed-out visitor still gets the page, not a redirect).
export default async function MutualTimePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const event = await getPublicEvent(slug);
  if (!event) {
    notFound();
  }

  // The link is public, so a failed sign-in lookup still renders the event, as a signed-out view.
  // It is reported so the failure is not invisible.
  const identity = await resolveRequestIdentity().catch((error: unknown) => {
    reportError(error, { area: 'mutual-time', op: 'public_page_identity', extra: { slug } });
    return null;
  });
  const userId = identity?.isAuthenticated ? identity.userId : null;
  const isSignedIn = Boolean(userId);

  let canVote = false;
  let picks: string[] = [];
  let expiredPicks = 0;
  if (userId) {
    // A failed approval or picks lookup must not fall back to the not-approved or no-picks view: an
    // approved member would be sent to verification, or think their vote was lost. Throw instead,
    // so the page error screen shows and the member can retry.
    const failLookup = (lookup: string) => (error: unknown): never => {
      reportError(error, { area: 'mutual-time', op: 'public_page_viewer', extra: { slug, lookup } });
      throw new Error(`Mutual Time event ${slug}: the ${lookup} lookup failed: ${failureReason(error)}`);
    };
    const tier = await getUnlockAccessTier(userId).catch(failLookup('approval'));
    canVote = tier === 'approved_full' || Boolean(identity?.isAdmin);
    const viewerPicks = await getViewerPicks(slug, userId).catch(failLookup('saved picks'));
    picks = viewerPicks.picks;
    expiredPicks = viewerPicks.expiredCount;
  }

  const signInUrl = getHostedSignInUrl() ?? '/';

  return (
    <MutualTimePublic
      initialEvent={event}
      initialViewer={{ canVote, picks, expiredPicks }}
      isSignedIn={isSignedIn}
      signInUrl={signInUrl}
      verifyUrl="/plugin/unlock"
    />
  );
}
