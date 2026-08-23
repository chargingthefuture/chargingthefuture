'use client';

import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';
import type { SignupCounts } from './unlock-signups-counts';

function SignupStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 92, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// The one line that stays visible when the panel is closed, so the number this panel exists for is
// never hidden behind a click.
export function signupHeadline(counts: SignupCounts): string {
  return `${counts.memberCount} member${counts.memberCount === 1 ? '' : 's'} · ${counts.notSubmittedCount} with no Quora URL`;
}

// Everything above the tabs: what the totals are, and what the "No Quora URL" number is made of.
export function UnlockSignupsSummary({ counts, truncated }: { counts: SignupCounts; truncated: boolean }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  return (
    <>
      <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 10, lineHeight: 1.6 }}>
        {counts.totalAccounts} account{counts.totalAccounts === 1 ? '' : 's'} in total, {counts.excludedCount}{' '}
        marked demo / test and {counts.deletedCount} who deleted their data. Someone who signs up and
        never gives a Quora URL never reaches the review queue, so they are listed here instead.
        {truncated ? ' Only the most recent accounts were read, so these numbers are a floor.' : ''}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <SignupStat label="Members" value={counts.memberCount} />
        <SignupStat label="Gave a Quora URL" value={counts.submittedCount} accent="#22C55E" />
        <SignupStat label="No Quora URL" value={counts.notSubmittedCount} accent="#F59E0B" />
        <SignupStat label="Demo / test" value={counts.excludedCount} />
        <SignupStat label="Left" value={counts.deletedCount} />
      </div>

      {/* What the "No Quora URL" number is actually made of. Someone who signed up and never came back
          is a different problem from someone who returned to the Unlock screen and still could not
          finish, and the fix for one does nothing for the other. */}
      {counts.notSubmittedCount > 0 ? (
        <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.7, marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          Of the {counts.notSubmittedCount} with no Quora URL:{' '}
          <strong style={{ color: t.TITLE }}>{counts.neverReturnedCount}</strong> have not signed in
          again since the day they signed up, and{' '}
          <strong style={{ color: t.TITLE }}>{counts.returnedAnywayCount}</strong> came back and still
          did not submit. Typically they loaded the Unlock screen{' '}
          <strong style={{ color: t.TITLE }}>{counts.medianScreenViews}</strong>{' '}
          time{counts.medianScreenViews === 1 ? '' : 's'}. A sign-in date only moves on a fresh
          sign-in, so the view count is the firmer of the two.
        </div>
      ) : null}
    </>
  );
}
