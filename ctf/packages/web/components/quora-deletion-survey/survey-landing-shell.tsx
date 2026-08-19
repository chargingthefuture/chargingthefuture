'use client';

import { useTheme } from '@/hooks/useTheme';
import { getSurveyTokens } from './survey-theme';
import { SurveyPublicLanding } from './survey-intro';

// The signed-out view of the survey. A thin client wrapper so the landing can read the active
// theme; everything it renders lives in survey-intro beside the form's own explanation, so the two
// can never drift into telling a person different things about what happens to their answer.
export function QuoraSurveyLandingShell({ signInUrl }: { signInUrl: string }) {
  const { theme } = useTheme();
  return <SurveyPublicLanding signInUrl={signInUrl} tokens={getSurveyTokens(theme)} />;
}
