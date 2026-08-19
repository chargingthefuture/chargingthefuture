'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import type { UnlockSignupAccount, UnlockSignupOverview } from 'lib/unlock/types';
import { failureText } from 'lib/errors/client-failure';
import { useTheme } from '@/hooks/useTheme';
import { getUnlockTokens } from './unlock-shared';
import { UnlockSignupRow } from './unlock-signup-row';

type SignupTab = 'not-submitted' | 'all' | 'excluded' | 'deleted';

const TAB_LABEL: Record<SignupTab, string> = {
  'not-submitted': 'No Quora URL',
  all: 'All sign-ups',
  excluded: 'Demo / test',
  deleted: 'Left',
};

// Whether this account counts as a member: not a demo/test account, and not someone who deleted their
// data. A demo/test mark wins over a deletion mark so nobody is subtracted twice.
function isCounted(account: UnlockSignupAccount): boolean {
  return !account.excluded && !account.deletedTheirData;
}

// The four numbers the panel leads with. Derived from the loaded accounts (not from the server's copy of
// the counts) so marking an account demo/test moves every number at once.
function summarize(accounts: UnlockSignupAccount[]) {
  const counted = accounts.filter(isCounted);
  const submitted = counted.filter((account) => account.hasSubmission).length;
  return {
    totalAccounts: accounts.length,
    excludedCount: accounts.filter((account) => account.excluded).length,
    deletedCount: accounts.filter((account) => !account.excluded && account.deletedTheirData).length,
    memberCount: counted.length,
    submittedCount: submitted,
    notSubmittedCount: counted.length - submitted,
  };
}

// Which accounts each tab shows. Kept out of the component so its own decision count stays small.
function accountsForTab(accounts: UnlockSignupAccount[], tab: SignupTab): UnlockSignupAccount[] {
  if (tab === 'not-submitted') return accounts.filter((account) => isCounted(account) && !account.hasSubmission);
  if (tab === 'excluded') return accounts.filter((account) => account.excluded);
  if (tab === 'deleted') return accounts.filter((account) => !account.excluded && account.deletedTheirData);
  return accounts;
}

function matchesSearch(account: UnlockSignupAccount, query: string): boolean {
  return [account.name, account.username, account.email, account.userId].some(
    (field) => field != null && field.toLowerCase().includes(query),
  );
}

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
export function UnlockSignupsPanel({ overview }: { overview: UnlockSignupOverview }) {
  const router = useRouter();
  const { theme } = useTheme();
  const t = getUnlockTokens(theme);
  const [accounts, setAccounts] = useState(overview.accounts);
  const [tab, setTab] = useState<SignupTab>('not-submitted');
  const [search, setSearch] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => summarize(accounts), [accounts]);
  const query = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const byTab = accountsForTab(accounts, tab);
    return query ? byTab.filter((account) => matchesSearch(account, query)) : byTab;
  }, [accounts, tab, query]);

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

  return (
    <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: t.HEADER, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Users size={15} color={t.ACCENT} />
        <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>Sign-ups</div>
      </div>

      {!overview.available ? (
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginTop: 6 }}>
          {overview.unavailableReason ?? 'The sign-up list could not be read.'}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 10, lineHeight: 1.6 }}>
            {counts.totalAccounts} account{counts.totalAccounts === 1 ? '' : 's'} in total, {counts.excludedCount}{' '}
            marked demo / test and {counts.deletedCount} who deleted their data. Someone who signs up and
            never gives a Quora URL never reaches the review queue, so they are listed here instead.
            {overview.truncated ? ' Only the most recent accounts were read, so these numbers are a floor.' : ''}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <SignupStat label="Members" value={counts.memberCount} />
            <SignupStat label="Gave a Quora URL" value={counts.submittedCount} accent="#22C55E" />
            <SignupStat label="No Quora URL" value={counts.notSubmittedCount} accent="#F59E0B" />
            <SignupStat label="Demo / test" value={counts.excludedCount} />
            <SignupStat label="Left" value={counts.deletedCount} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {(['not-submitted', 'all', 'excluded', 'deleted'] as const).map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setTab(tabKey)}
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
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sign-ups by name, handle, email, or user id"
            aria-label="Search sign-ups"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, marginBottom: 10 }}
          />

          {error ? (
            <div role="alert" style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{error}</div>
          ) : null}

          {visible.length === 0 ? (
            <div style={{ fontSize: 12, color: t.MUTED }}>
              {query ? 'No sign-up matches that search.' : 'Nothing to show on this tab.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visible.map((account) => (
                <UnlockSignupRow
                  key={account.userId}
                  account={account}
                  busy={busyUserId === account.userId}
                  onToggleExcluded={(userId, excluded) => void toggleExcluded(userId, excluded)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
