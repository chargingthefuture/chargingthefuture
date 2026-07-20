import { notFound } from 'next/navigation';
import { resolveRequestIdentity } from 'lib/auth/request-identity';
import { getUnlockAccessTier } from 'lib/unlock/access';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { getPublicEvent, getViewerPicks } from 'lib/mutual-time/repository';
import { MutualTimePublic } from '@/components/mutual-time/mutual-time-public';

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

  const identity = await resolveRequestIdentity().catch(() => null);
  const userId = identity?.isAuthenticated ? identity.userId : null;
  const isSignedIn = Boolean(userId);

  let canVote = false;
  let picks: string[] = [];
  if (userId) {
    const tier = await getUnlockAccessTier(userId).catch(() => null);
    canVote = tier === 'approved_full' || Boolean(identity?.isAdmin);
    picks = await getViewerPicks(slug, userId).catch(() => []);
  }

  const signInUrl = getHostedSignInUrl() ?? '/sign-in';

  return (
    <MutualTimePublic
      initialEvent={event}
      initialViewer={{ canVote, picks }}
      isSignedIn={isSignedIn}
      signInUrl={signInUrl}
      verifyUrl="/plugin/unlock"
    />
  );
}
