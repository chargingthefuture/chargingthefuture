'use client';

import { useState } from 'react';
import { CheckCircle, Key } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';

// "Add Quora URL" on a sign-up row for somebody who never gave one.
//
// The review queue only ever holds members who submitted a URL, and the Edit control lives on a queue
// card — so for a member with no submission there was no card, no Edit, and nothing an admin could do
// with a profile they had found by hand. This is that missing control, on the one list where those
// members actually appear.
//
// It does not approve anybody. Saving creates the same pending submission the member would have
// created, and the ordinary review happens on the queue card afterwards.
export function UnlockSignupAddUrl({
  userId,
  busy,
  onAdd,
}: {
  userId: string;
  busy: boolean;
  onAdd: (userId: string, url: string) => void;
}) {
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const canSave = url.trim().length > 0 && !busy;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ marginTop: 8, marginRight: 8, padding: '5px 10px', borderRadius: 8, background: `${t.ACCENT}1A`, border: `1px solid ${t.ACCENT}55`, color: t.ACCENT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        <Key size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        Add Quora URL
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`add-url-${userId}`} style={{ fontSize: 11, fontWeight: 700, color: t.TITLE }}>
        Quora profile URL you found for this member
      </label>
      <input
        id={`add-url-${userId}`}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && canSave) onAdd(userId, url.trim());
        }}
        placeholder="https://quora.com/profile/Their-Name"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, background: t.SURFACE_CARD, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13 }}
      />
      <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
        Saved as entered by you, not by the member, and it goes to the review queue as pending — you
        still approve or reject it there.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onAdd(userId, url.trim())}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: canSave ? `${t.ACCENT}1A` : t.SURFACE, border: `1px solid ${canSave ? `${t.ACCENT}55` : t.BORDER_SOLID}`, color: canSave ? t.ACCENT : t.MUTED, fontSize: 12, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed' }}
        >
          <CheckCircle size={12} /> {busy ? 'Saving…' : 'Save URL'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setUrl('');
          }}
          style={{ padding: '6px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
