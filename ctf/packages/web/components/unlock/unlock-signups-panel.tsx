'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import type { UnlockSignupOverview } from 'lib/unlock/types';
import { failureText } from 'lib/errors/client-failure';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens, type UnlockTokens } from './unlock-shared';
import { UnlockSignupRow } from './unlock-signup-row';
import { UnlockSignupsSummary, signupHeadline } from './unlock-signups-summary';
import {
  accountsForTab,
  matchesSearch,
  summarize,
  SIGNUP_TABS,
  TAB_LABEL,
  type SignupTab,
} from './unlock-signups-counts';

// How many sign-ups the list shows before you ask for more. The panel sits above the review queue, so an
// unbounded list of everyone who never gave a Quora URL pushed the queue off the bottom of the screen.
const PAGE_SIZE = 10;

// The panel's one visible line when it is closed: title, the two numbers worth knowing at a glance, and
// the open/close control. The whole row is the button so it is easy to hit on a phone.
function SignupsHeader({
  t,
  open,
  onToggle,
  headline,
}: {
  t: UnlockTokens;
  open: boolean;
  onToggle: () => void;
  headline: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="unlock-signups-body"
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 0, background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
    >
      <Users size={15} color={t.ACCENT} />
      <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>Sign-ups</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 11, color: t.MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {headline}
        </span>
        {open ? <ChevronUp size={16} color={t.MUTED} /> : <ChevronDown size={16} color={t.MUTED} />}
      </span>
    </button>
  );
}

// Admin panel: how many people have signed up, and which of them never gave us a Quora URL.
//
// Unlock only ever sees someone once they submit a Quora URL, so before this panel the total sign-up
// number lived only in the auth provider's dashboard and the people who stopped before verifying were
// invisible. Both readings are here now. A large "No Quora URL" number is the signal to look at: either
// the Quora step is turning spam away as intended, or people are arriving from somewhere other than
// Quora and cannot finish a step that assumes they came from there.
//
// Demo and test accounts are marked from this panel and subtracted from every number above, since
// nothing on the account itself says it is not a real member.
//
// The panel starts closed. The admin's daily job is the review queue underneath it, and the full list of
// everyone who never submitted stood between the two; the headline keeps the number in sight either way.
export function UnlockSignupsPanel({ overview }: { overview: UnlockSignupOverview }) {
  const router = useRouter();
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const [accounts, setAccounts] = useState(overview.accounts);
  // Closed by default, EXCEPT when the roster could not be read: an error nobody can see is worse
  // than a long panel, so that one case opens itself and says why.
  const [open, setOpen] = useState(!overview.available);
  const [tab, setTab] = useState<SignupTab>('not-submitted');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => summarize(accounts), [accounts]);
  const query = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const byTab = accountsForTab(accounts, tab);
    return query ? byTab.filter((account) => matchesSearch(account, query)) : byTab;
  }, [accounts, tab, query]);
  const shown = visible.slice(0, limit);
  const remaining = visible.length - shown.length;

  // Any change to what the list is showing starts it back at one page, so a switched tab or a new search
  // never opens on a list already scrolled long.
  function pickTab(next: SignupTab) {
    setTab(next);
    setLimit(PAGE_SIZE);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setLimit(PAGE_SIZE);
  }

  async function toggleExcluded(userId: string, excluded: boolean) {
    setBusyUserId(userId);
    setError(null);
    try {
      const res = await fetch('/api/unlock/admin/excluded-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ userId, excluded }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; code?: string } | null;
      if (!res.ok) {
        setError(data?.message ?? data?.code ?? `Update failed (${res.status}).`);
        return;
      }
      setAccounts((prev) =>
        prev.map((account) => (account.userId === userId ? { ...account, excluded, excludedNote: null } : account)),
      );
      router.refresh();
    } catch (caught) {
      setError(failureText(caught, { area: 'unlock', op: 'exclude_account', fallback: 'Network error. Try again.' }));
    } finally {
      setBusyUserId(null);
    }
  }

  const headline = overview.available ? signupHeadline(counts) : 'Could not be read';

  return (
    <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}` }}>
      <SignupsHeader t={t} open={open} onToggle={() => setOpen((prev) => !prev)} headline={headline} />

      {!open ? null : (
        <div id="unlock-signups-body" style={{ marginTop: 10 }}>
          {!overview.available ? (
            <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>
              {overview.unavailableReason ?? 'The sign-up list could not be read.'}
            </div>
          ) : (
            <>
              <UnlockSignupsSummary counts={counts} truncated={overview.truncated} />

              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {SIGNUP_TABS.map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => pickTab(tabKey)}
                    aria-pressed={tab === tabKey}
                    style={{ padding: '6px 14px', borderRadius: 8, background: tab === tabKey ? t.ACCENT : t.SURFACE, border: `1px solid ${tab === tabKey ? t.ACCENT : t.BORDER_SOLID}`, color: tab === tabKey ? '#fff' : t.MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {TAB_LABEL[tabKey]}
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={search}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder="Search sign-ups by name, handle, email, or user id"
                aria-label="Search sign-ups"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, marginBottom: 10 }}
              />

              {error ? (
                <div role="alert" style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{error}</div>
              ) : null}

              {shown.length === 0 ? (
                <div style={{ fontSize: 12, color: t.MUTED }}>
                  {query ? 'No sign-up matches that search.' : 'Nothing to show on this tab.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {shown.map((account) => (
                    <UnlockSignupRow
                      key={account.userId}
                      account={account}
                      busy={busyUserId === account.userId}
                      onToggleExcluded={(userId, excluded) => void toggleExcluded(userId, excluded)}
                    />
                  ))}
                </div>
              )}

              {remaining > 0 ? (
                <button
                  type="button"
                  onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                  style={{ marginTop: 10, width: '100%', padding: '8px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} still hidden
                </button>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
