'use client';

import { useState } from 'react';
import { Ban } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';

// "Ban this account" on a sign-up row.
//
// The Spam and Duplicate buttons hang off a submission, so an account that signed up and never gave a
// Quora URL had no control at all: the admin page showed exactly who it was and offered nothing to do
// about it. This is that missing control, on the one list where those accounts appear.
//
// Banning is not deleting. The account and its row stay, so the record of who arrived stays countable
// and the ban can be lifted from the same button.
export function UnlockSignupBan({
  userId,
  banned,
  busy,
  onToggleBanned,
}: {
  userId: string;
  banned: boolean;
  busy: boolean;
  onToggleBanned: (userId: string, banned: boolean) => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const [confirming, setConfirming] = useState(false);

  // Lifting a ban restores access and is trivially repeatable, so it does not ask twice. Applying one
  // does: it signs somebody out of everything at once, which is not a press to make by accident.
  if (banned) {
    return (
      <button
        type="button"
        onClick={() => onToggleBanned(userId, false)}
        disabled={busy}
        style={{ marginTop: 8, marginRight: 8, padding: '5px 10px', borderRadius: 8, background: t.SURFACE_CARD, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        Lift this ban
      </button>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        style={{ marginTop: 8, marginRight: 8, padding: '5px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        <Ban size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        Ban this account
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#FCD34D' }}>
        Ban this account everywhere? They lose this app and anything else they sign into with it.
      </span>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onToggleBanned(userId, true);
        }}
        disabled={busy}
        style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.45)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        Confirm ban
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        style={{ padding: '5px 10px', borderRadius: 8, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  );
}
