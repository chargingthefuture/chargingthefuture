'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, LifeBuoy } from 'lucide-react';
import type { UnlockSignupAccount } from 'lib/unlock/types';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens, type UnlockTokens } from './unlock-shared';
import { UnlockSignupHelp } from './unlock-signup-help';
import { identityOf, statusChip } from './unlock-signup-row';
import { openUnlockHelpRequests, unlockHelpRequestsHeadline } from 'lib/unlock/help-request-open';

// One member waiting on help: who they are, their state, how to reach them, then the date, what they
// wrote and Done, from the same control the sign-up row uses.
function HelpRequestRow({
  account,
  busy,
  onMarkHelpDone,
  t,
}: {
  account: UnlockSignupAccount;
  busy: boolean;
  onMarkHelpDone: (userId: string, done: boolean) => void;
  t: UnlockTokens;
}) {
  const chip = statusChip(account);
  const { title, handle } = identityOf(account);
  return (
    <li style={{ padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, wordBreak: 'break-word' }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: chip.color }}>{chip.label}</span>
      </div>
      {handle ? <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>@{handle}</div> : null}
      {account.email ? (
        <a href={`mailto:${account.email}`} style={{ display: 'block', fontSize: 11, color: t.ACCENT, marginTop: 2, wordBreak: 'break-all' }}>
          {account.email}
        </a>
      ) : null}
      <UnlockSignupHelp account={account} busy={busy} onMarkHelpDone={onMarkHelpDone} />
    </li>
  );
}

// The line under the stat tiles on /admin/unlock that says why the Unlock tile on the admin landing has
// a dot: how many members asked for help and still wait. Tapping it lists just them. Nothing shows
// when none waits.
export function UnlockHelpRequests({
  accounts,
  busyUserId,
  onMarkHelpDone,
}: {
  accounts: readonly UnlockSignupAccount[];
  busyUserId: string | null;
  onMarkHelpDone: (userId: string, done: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const [open, setOpen] = useState(false);
  const waiting = openUnlockHelpRequests(accounts);
  if (waiting.length === 0) return null;

  return (
    <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}` }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="unlock-help-requests-body"
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 0, background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
      >
        <LifeBuoy size={15} color="#F59E0B" />
        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>{unlockHelpRequestsHeadline(waiting.length)}</span>
        <span style={{ marginLeft: 'auto', display: 'flex' }}>
          {open ? <ChevronUp size={16} color={t.MUTED} /> : <ChevronDown size={16} color={t.MUTED} />}
        </span>
      </button>

      {open ? (
        <div id="unlock-help-requests-body" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.6, marginBottom: 10 }}>
            The dot on the Unlock tile goes once each request is marked Done, or once their address is
            approved or turned down.
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {waiting.map((account) => (
              <HelpRequestRow
                key={account.userId}
                account={account}
                busy={busyUserId === account.userId}
                onMarkHelpDone={onMarkHelpDone}
                t={t}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
