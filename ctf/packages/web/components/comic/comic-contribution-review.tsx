'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, X } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { useTheme } from '@/hooks/useTheme';
import { getComicTokens } from './comic-shared';
import { failureText } from 'lib/errors/client-failure';

// Admin review of member-contributed writing. This screen is the human step the knowledge page
// promises: nothing a member sends can reach the assistant until someone reads it here.
//
// It shows the writing itself, not a count, because the decision cannot be made from a summary — the
// point is to keep off-topic posts, anything naming a third party, and anything a bad actor sent out
// of the library.

type ComicTokens = ReturnType<typeof getComicTokens>;

type ReviewEntry = {
  id: string;
  entryType: string;
  question: string | null;
  content: string;
  sourceUrl: string | null;
  excluded: boolean;
  promoted: boolean;
};

type ReviewContribution = {
  id: string;
  kind: 'links' | 'export';
  status: string;
  userId: string;
  consentVersion: string;
  thirdPartyNote: string;
  entryCount: number;
  discardedSections: string[];
  createdAtIso: string;
  entries: ReviewEntry[];
};

type ReviewResult = {
  message?: string;
  promoted?: number;
  alreadyPresent?: number;
  grant?: { status: string; amount?: number };
};

type ReviewAction = 'accept' | 'decline';

// The request body differs by action, so build it once outside the handler to keep the handler's
// branching low.
function buildReviewPayload(
  action: ReviewAction,
  excludedEntryIds: string[],
  reason: string,
): { action: ReviewAction; excludedEntryIds?: string[]; reason?: string } {
  return action === 'accept' ? { action, excludedEntryIds } : { action, reason };
}

// Say plainly what happened to the credits — especially the not-unlocked case, which is a decision
// rather than a failure and would otherwise look like a silent no-op.
function grantLine(grant: ReviewResult['grant']): string {
  if (grant?.status === 'granted') return `${grant.amount} ServiceCredits granted.`;
  if (grant?.status === 'skipped_not_unlocked') {
    return 'No credits: this member is not verified yet. The writing is in the library; the grant can be made once they finish Unlock.';
  }
  if (grant?.status === 'already_granted') return 'Credits were already granted for this contribution.';
  return 'The credits grant did not go through — retry it by hand.';
}

function acceptNotice(data: ReviewResult | null): string {
  const alreadyThere = data?.alreadyPresent ? `, ${data.alreadyPresent} already there` : '';
  return `Accepted. ${data?.promoted ?? 0} added to the library${alreadyThere}. ${grantLine(data?.grant)}`;
}

export function ComicContributionReview() {
  const { theme } = useTheme();
  const t = getComicTokens(theme);

  const [contributions, setContributions] = useState<ReviewContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Entries the reviewer has struck out, per contribution. Nothing is excluded by default — the
  // reviewer opts a post OUT after reading it, rather than opting each one in, so a skim cannot
  // silently drop someone's writing.
  const [excluded, setExcluded] = useState<Record<string, Set<string>>>({});
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/comic/admin/contributions?status=pending_review', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as
        | { contributions?: ReviewContribution[]; message?: string }
        | null;
      if (!res.ok) {
        setError(data?.message ?? 'Could not load contributions.');
      } else {
        setContributions(data?.contributions ?? []);
        setError(null);
      }
    } catch (caught) {
      setError(failureText(caught, { area: 'comic', op: 'load', fallback: 'Could not reach the server.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleExcluded(contributionId: string, entryId: string) {
    setExcluded((current) => {
      const set = new Set(current[contributionId] ?? []);
      if (set.has(entryId)) set.delete(entryId);
      else set.add(entryId);
      return { ...current, [contributionId]: set };
    });
  }

  async function review(contributionId: string, action: ReviewAction) {
    setBusyId(contributionId);
    setError(null);
    setNotice(null);
    try {
      const payload = buildReviewPayload(
        action,
        [...(excluded[contributionId] ?? [])],
        declineReason[contributionId] ?? '',
      );
      const res = await fetch(`/api/comic/admin/contributions/${contributionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as ReviewResult | null;
      if (!res.ok) {
        setError(data?.message ?? 'Could not record that review.');
        return;
      }
      setNotice(
        action === 'decline'
          ? 'Declined. The contributor sees your reason on their own page.'
          : acceptNotice(data),
      );
      await load();
    } catch (caught) {
      setError(failureText(caught, { area: 'comic', op: 'review', fallback: 'Could not reach the server.' }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <MobileScreenHeader
        title="Contributed writing"
        accent={t.ACCENT}
        icon={<BookOpen size={18} color={t.ACCENT} />}
        actions={<PluginUserShellButton href="/knowledge" accent={t.ACCENT} label="Member view" />}
      />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 48px' }}>
        {error ? (
          <p role="alert" style={{ ...bannerStyle(t), color: '#F87171', borderColor: 'rgba(239,68,68,0.35)' }}>{error}</p>
        ) : null}
        {notice ? (
          <p role="status" style={{ ...bannerStyle(t), color: t.ACCENT, borderColor: `${t.ACCENT}55` }}>{notice}</p>
        ) : null}

        {loading ? (
          <p style={{ color: t.SUBTLE, fontSize: 14 }}>Loading…</p>
        ) : contributions.length === 0 ? (
          <p style={{ color: t.SUBTLE, fontSize: 14 }}>Nothing waiting to be read.</p>
        ) : (
          contributions.map((contribution) => (
            <ContributionCard
              key={contribution.id}
              t={t}
              contribution={contribution}
              excludedSet={excluded[contribution.id] ?? new Set<string>()}
              busyId={busyId}
              declineReason={declineReason[contribution.id] ?? ''}
              onToggleExcluded={toggleExcluded}
              onReview={review}
              onDeclineReasonChange={(value) =>
                setDeclineReason((current) => ({ ...current, [contribution.id]: value }))
              }
            />
          ))
        )}
      </div>
    </main>
  );
}

function ContributionCard({
  t,
  contribution,
  excludedSet,
  busyId,
  declineReason,
  onToggleExcluded,
  onReview,
  onDeclineReasonChange,
}: {
  t: ComicTokens;
  contribution: ReviewContribution;
  excludedSet: Set<string>;
  busyId: string | null;
  declineReason: string;
  onToggleExcluded: (contributionId: string, entryId: string) => void;
  onReview: (contributionId: string, action: ReviewAction) => void;
  onDeclineReasonChange: (value: string) => void;
}) {
  const keeping = contribution.entries.length - excludedSet.size;
  const isBusy = busyId === contribution.id;
  const nothingKept = keeping === 0;
  const disableAccept = isBusy || nothingKept;

  return (
    <section style={cardStyle(t)}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          {contribution.entries.length} {contribution.entries.length === 1 ? 'piece' : 'pieces'} from{' '}
          {contribution.userId}
        </h2>
        <span style={{ fontSize: 12, color: t.MUTED }}>
          {contribution.kind === 'links' ? 'picked posts' : 'whole export'} ·{' '}
          {new Date(contribution.createdAtIso).toLocaleDateString()} · consent{' '}
          {contribution.consentVersion}
        </span>
      </div>

      {/* Surfaced up front, not buried with the text: if the contributor said someone else
          is named, that is the thing to check before anything is promoted. */}
      {contribution.thirdPartyNote ? (
        <p style={{ ...noteStyle(t), borderColor: 'rgba(245,158,11,0.4)', color: '#F59E0B' }}>
          Names someone else: {contribution.thirdPartyNote}
        </p>
      ) : null}
      {contribution.discardedSections.length > 0 ? (
        <p style={noteStyle(t)}>
          Dropped automatically on arrival: {contribution.discardedSections.join(', ')}.
        </p>
      ) : null}

      {contribution.entries.map((entry) => (
        <EntryRow
          key={entry.id}
          t={t}
          entry={entry}
          isExcluded={excludedSet.has(entry.id)}
          onToggle={() => onToggleExcluded(contribution.id, entry.id)}
        />
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button
          type="button"
          onClick={() => void onReview(contribution.id, 'accept')}
          disabled={disableAccept}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 10,
            background: `${t.ACCENT}25`,
            border: `1px solid ${t.ACCENT}66`,
            color: t.ACCENT,
            fontSize: 14,
            fontWeight: 700,
            cursor: disableAccept ? 'not-allowed' : 'pointer',
            opacity: nothingKept ? 0.5 : 1,
          }}
        >
          <Check size={15} /> Accept {keeping} of {contribution.entries.length}
        </button>
        <button
          type="button"
          onClick={() => void onReview(contribution.id, 'decline')}
          disabled={isBusy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(220,38,38,0.16)',
            border: '1px solid rgba(220,38,38,0.5)',
            color: '#F87171',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <X size={15} /> Decline
        </button>
      </div>
      <label htmlFor={`decline-reason-${contribution.id}`} style={labelStyle(t)}>
        Reason, if declining — the contributor reads this
      </label>
      <input
        id={`decline-reason-${contribution.id}`}
        value={declineReason}
        onChange={(event) => onDeclineReasonChange(event.target.value)}
        placeholder="e.g. these posts are not about being targeted"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 4,
          padding: '9px 12px',
          borderRadius: 10,
          background: t.INPUT_BG,
          border: `1px solid ${t.BORDER_SOLID}`,
          color: t.TITLE,
          fontSize: 13,
        }}
      />
    </section>
  );
}

function EntryRow({
  t,
  entry,
  isExcluded,
  onToggle,
}: {
  t: ComicTokens;
  entry: ReviewEntry;
  isExcluded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        background: t.SURFACE,
        border: `1px solid ${t.BORDER_SOLID}`,
        opacity: isExcluded ? 0.45 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: 'uppercase' }}>
          {entry.entryType}
        </span>
        {entry.sourceUrl ? (
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: t.ACCENT }}
          >
            Open on Quora
          </a>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            borderRadius: 8,
            background: 'transparent',
            border: `1px solid ${t.BORDER_SOLID}`,
            color: t.SUBTLE,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isExcluded ? 'Put back' : 'Leave out'}
        </button>
      </div>
      {entry.question ? (
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>{entry.question}</p>
      ) : null}
      <p style={{ fontSize: 13, lineHeight: 1.6, color: t.TEXT, margin: 0, whiteSpace: 'pre-wrap' }}>
        {entry.content}
      </p>
    </div>
  );
}

const cardStyle = (t: ComicTokens): React.CSSProperties => ({
  marginTop: 18,
  borderRadius: 14,
  background: t.HEADER,
  border: `1px solid ${t.BORDER_SOLID}`,
  padding: 18,
});
const bannerStyle = (t: ComicTokens): React.CSSProperties => ({
  marginTop: 14,
  padding: '10px 14px',
  borderRadius: 10,
  background: t.SURFACE,
  border: '1px solid',
  fontSize: 14,
});
const noteStyle = (t: ComicTokens): React.CSSProperties => ({
  marginTop: 8,
  marginBottom: 0,
  padding: '8px 12px',
  borderRadius: 8,
  border: `1px solid ${t.BORDER_SOLID}`,
  fontSize: 13,
  color: t.MUTED,
});
const labelStyle = (t: ComicTokens): React.CSSProperties => ({
  display: 'block',
  marginTop: 12,
  fontSize: 12,
  fontWeight: 600,
  color: t.SUBTLE,
});
