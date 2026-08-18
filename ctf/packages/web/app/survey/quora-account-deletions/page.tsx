import type { Metadata } from 'next';
import { QuoraSurveyPublicShell } from '@/components/quora-deletion-survey/survey-public-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quora account removals — survey',
  description:
    'A short survey for people whose Quora accounts were removed: which accounts, when, and what they were writing about. No sign-in and no contact details.',
};

// Public, sign-in-free. This link is read outside the app — on Quora, on Reddit, in a blog post —
// so it sits at a short top-level path rather than under /apps, and it never checks for a session.
// Someone whose account was taken for writing about being targeted has no reason to trust a form
// that asks them to make an account first.
export default function QuoraDeletionSurveyPage() {
  return <QuoraSurveyPublicShell />;
}
