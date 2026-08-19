'use client';

import type { UnlockSignupAccount } from 'lib/unlock/types';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';

// Color and wording for what happened to this person's Quora URL, including the case this panel exists
// for: they signed up and never submitted one.
function statusChip(account: UnlockSignupAccount): { label: string; color: string } {
  if (account.deletedTheirData) return { label: 'Deleted their data', color: '#6B7280' };
  if (!account.hasSubmission) return { label: 'No Quora URL', color: '#F59E0B' };
  if (account.reviewStatus === 'approved') return { label: 'Approved', color: '#22C55E' };
  if (account.reviewStatus === 'rejected' || account.reviewStatus === 'spam') {
    return { label: account.reviewStatus === 'spam' ? 'Spam' : 'Rejected', color: '#EF4444' };
  }
  return { label: 'Awaiting review', color: '#F59E0B' };
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

// The heading for the row: the most human identifier the account carries, falling back to the raw id so
// a row is never blank. The handle is repeated on its own line only when it is not already the heading.
function identityOf(account: UnlockSignupAccount): { title: string; handle: string | null } {
  if (account.name) return { title: account.name, handle: account.username };
  if (account.username) return { title: `@${account.username}`, handle: null };
  return { title: account.email ?? account.userId, handle: null };
}

// "Signed up 3 Aug 2026 · has never signed in since" — one line, built here so the row itself stays
// inside the rule-116 complexity limit.
function timingLine(account: UnlockSignupAccount): string {
  const signedUp = shortDate(account.createdAt);
  const lastSignIn = shortDate(account.lastSignInAt);
  const joined = signedUp ? `Signed up ${signedUp}` : 'Sign-up date unknown';
  return `${joined} · ${lastSignIn ? `last signed in ${lastSignIn}` : 'has never signed in since'}`;
}

// How many times they loaded the Unlock screen. Said only for a member with no submission, where it is
// the difference between seeing the ask once and coming back to it repeatedly without finishing.
function screenViewLine(account: UnlockSignupAccount): string | null {
  if (account.hasSubmission) return null;
  if (account.unlockScreenViews === 0) return 'Has not opened the Unlock screen since it started being recorded';
  return account.unlockScreenViews === 1
    ? 'Opened the Unlock screen once'
    : `Opened the Unlock screen ${account.unlockScreenViews} times`;
}

// Said only for someone who asked to be forgotten: their submission was deleted with the rest of their
// data, so the row would otherwise read as "never gave a Quora URL" with nothing to explain it.
function departureLine(account: UnlockSignupAccount): string | null {
  if (!account.deletedTheirData) return null;
  const on = shortDate(account.deletedAt);
  return on
    ? `Asked to be forgotten on ${on} — their data, this submission included, was deleted. Not counted.`
    : 'Asked to be forgotten — their data, this submission included, was deleted. Not counted.';
}

// One muted detail line under the row heading. Renders nothing when there is nothing to say, so the row
// itself carries no per-line conditional.
function DetailLine({ text, breakAll = false }: { text: string | null; breakAll?: boolean }) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  if (!text) return null;
  return (
    <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2, wordBreak: breakAll ? 'break-all' : 'normal' }}>
      {text}
    </div>
  );
}

// One signed-up account in the Unlock admin's sign-up list: who they are, when they joined, whether they
// ever came back, what happened to their Quora URL, and the button that takes them out of (or puts them
// back into) the sign-up counts.
export function UnlockSignupRow({
  account,
  busy,
  onToggleExcluded,
}: {
  account: UnlockSignupAccount;
  busy: boolean;
  onToggleExcluded: (userId: string, excluded: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const chip = statusChip(account);
  const { title, handle } = identityOf(account);

  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, wordBreak: 'break-word' }}>{title}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: chip.color }}>{chip.label}</span>
        {account.excluded ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: t.MUTED }}>Demo / test — not counted</span>
        ) : null}
      </div>

      <DetailLine text={handle ? `@${handle}` : null} />
      <DetailLine text={account.email} breakAll />
      <DetailLine text={timingLine(account)} />
      <DetailLine text={screenViewLine(account)} />
      <DetailLine text={departureLine(account)} />
      <DetailLine text={account.excludedNote ? `Note: ${account.excludedNote}` : null} />

      <button
        type="button"
        onClick={() => onToggleExcluded(account.userId, !account.excluded)}
        disabled={busy}
        style={{
          marginTop: 8,
          padding: '5px 10px',
          borderRadius: 8,
          background: t.SURFACE_CARD,
          border: `1px solid ${t.BORDER_SOLID}`,
          color: t.MUTED,
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {account.excluded ? 'Count this account again' : 'Mark as demo / test'}
      </button>
    </div>
  );
}
