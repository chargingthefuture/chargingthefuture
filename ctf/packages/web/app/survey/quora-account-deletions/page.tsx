import type { Metadata } from 'next';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { getHostedSignInUrl } from 'lib/auth/provider-env';
import { QuoraSurveyPublicShell } from '@/components/quora-deletion-survey/survey-public-shell';
import { QuoraSurveyLandingShell } from '@/components/quora-deletion-survey/survey-landing-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quora account removals — survey',
  description:
    'A short survey for people whose Quora accounts were removed: which accounts, when, and what they were writing about. Answers are stored with no link to your account.',
};

// A short top-level path, not one under /apps, because this link is read outside the app — on
// Quora, on Reddit, in a blog post — and has to be easy to type and to trust.
//
// Signing in is required to submit (owner decision, 2026-08-19), for the same reason the knowledge
// library and Mutual Time ask: an open write path on this subject fills with junk, and a junk
// answer sitting in the same table as a real one is worse than a missing answer. Any signed-in
// member qualifies, verified or not — someone who made an account five minutes ago to answer this
// is exactly who the survey is for.
//
// A signed-out visitor gets the full explanation and a sign-in link rather than a redirect. Most
// people opening this link have no account, and bouncing them to a sign-in form would tell them
// nothing about what they were being asked for or what happens to the answer.
export default async function QuoraDeletionSurveyPage() {
  const decision = await evaluatePluginAccess({
    minUnlockTier: 'any_authenticated',
    requireUsername: false,
  });

  if (!decision.allowed) {
    return <QuoraSurveyLandingShell signInUrl={getHostedSignInUrl() ?? '/sign-in'} />;
  }

  return <QuoraSurveyPublicShell />;
}
