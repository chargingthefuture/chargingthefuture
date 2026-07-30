'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldOff, Trash2 } from 'lucide-react';
import type { SpamQuoraUrlEntry } from 'lib/unlock/types';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';

// Admin panel: view and remove entries on the persistent spam Quora-URL denylist. Marking a submission
// spam records its normalized URL here so the same Quora account is auto-blocked on re-submission (even
// from a new account) and never re-enters the review queue. Removing a URL here only stops FUTURE
// submissions of it from being auto-blocked — it does not unblock a member already restricted for it
// (that is reversed by re-reviewing their submission to approved/rejected).
export function UnlockSpamDenylistPanel({ initialEntries }: { initialEntries: SpamQuoraUrlEntry[] }) {
  const router = useRouter();
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const [entries, setEntries] = useState(initialEntries);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(normalized: string) {
    setBusyUrl(normalized);
    setError(null);
    try {
      const res = await fetch('/api/unlock/admin/spam-denylist/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ quoraProfileUrlNormalized: normalized }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string; code?: string } | null;
      if (!res.ok) {
        setError(data?.reason ?? data?.code ?? `Remove failed (${res.status}).`);
        return;
      }
      setConfirmUrl(null);
      setEntries((prev) => prev.filter((e) => e.quoraProfileUrlNormalized !== normalized));
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyUrl(null);
    }
  }

  return (
    <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <ShieldOff size={15} color={t.ACCENT} />
        <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>Spam Quora-URL denylist</div>
      </div>
      <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 12, lineHeight: 1.6 }}>
        A URL lands here when you mark a submission spam. Any later submission of it — even from a new
        account — is auto-marked spam and blocked, so you never review the same Quora account twice. The
        URL is kept even after the member deletes their data. Removing a URL here only stops future
        submissions from being auto-blocked; it does not unblock a member already restricted for it — to
        do that, re-review their submission to approved or rejected.
      </div>

      {error ? (
        <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{error}</div>
      ) : null}

      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: t.MUTED }}>No Quora URLs are on the spam denylist.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry) => {
            const busy = busyUrl === entry.quoraProfileUrlNormalized;
            return (
              <div
                key={entry.quoraProfileUrlNormalized}
                style={{ padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, wordBreak: 'break-all' }}>
                  {entry.quoraProfileUrlNormalized}
                </div>
                <div style={{ fontSize: 11, color: t.MUTED, marginTop: 4, marginBottom: 8 }}>
                  Flagged {new Date(entry.lastFlaggedAt).toLocaleDateString()}
                  {entry.flagCount > 1 ? ` · ${entry.flagCount} times` : ''}
                </div>
                {confirmUrl === entry.quoraProfileUrlNormalized ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#FCD34D' }}>Remove from the denylist?</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(entry.quoraProfileUrlNormalized)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                    >
                      {busy ? 'Removing…' : 'Confirm remove'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmUrl(null)}
                      style={{ padding: '6px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmUrl(entry.quoraProfileUrlNormalized)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
