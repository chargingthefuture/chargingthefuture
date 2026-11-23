'use client';

import type { UnlockSignupAccount } from 'lib/unlock/types';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';

// The help request on a sign-up row (owner decision, 2026-11-23): "Asked for help" with the date for
// every member who pressed "ask for help", what they typed when they typed something, and Done, which
// an admin presses once they have looked the member up. A request waits, and the Unlock tile on the
// admin landing carries its dot, until Done or until the member's address is approved or turned down.

function shortDate(iso: string | null): string {
  const parsed = iso ? new Date(iso) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString() : 'an unknown date';
}

export function unlockHelpRequestLine(account: UnlockSignupAccount): string | null {
  if (!account.helpRequestedAt) return null;
  const asked = `Asked for help on ${shortDate(account.helpRequestedAt)}`;
  if (account.helpDoneAt) return `${asked} · marked done on ${shortDate(account.helpDoneAt)}`;
  return account.helpRequestOpen ? `${asked} · waiting` : `${asked} · handled in review`;
}

export function UnlockSignupHelp({
  account,
  busy,
  onMarkHelpDone,
}: {
  account: UnlockSignupAccount;
  busy: boolean;
  onMarkHelpDone: (userId: string, done: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const line = unlockHelpRequestLine(account);
  if (!line) return null;
  const canMark = account.helpRequestOpen || account.helpDoneAt !== null;
  return (
    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: account.helpRequestOpen ? '#F59E0B' : t.MUTED }}>{line}</span>
      {account.quoraHint ? <span style={{ fontSize: 11, color: t.MUTED, wordBreak: 'break-all' }}>Told us: {account.quoraHint}</span> : null}
      {canMark ? (
        <button
          type="button"
          onClick={() => onMarkHelpDone(account.userId, account.helpDoneAt === null)}
          disabled={busy}
          style={{
            padding: '5px 10px',
            borderRadius: 8,
            background: t.SURFACE_CARD,
            border: `1px solid ${t.BORDER_SOLID}`,
            color: t.TITLE,
            fontSize: 12,
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {account.helpDoneAt === null ? 'Done' : 'Mark as waiting again'}
        </button>
      ) : null}
    </div>
  );
}
