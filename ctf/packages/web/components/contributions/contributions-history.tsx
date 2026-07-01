'use client';

import { Inbox } from 'lucide-react';
import type { ContributionSubmission } from '@/lib/contributions/types';
import {
  shortDate,
  statusColor,
  statusLabel,
  submissionLabel,
  type ContributionsTokens,
} from './contributions-shared';

const PRIVACY_NOTE =
  'Contributions are private between you and the platform owner. There are no public donor lists or recognition boards.';

function HistoryItem({ item, t }: { item: ContributionSubmission; t: ContributionsTokens }) {
  const sc = statusColor(item.status, t);
  const showCredits = item.status === 'confirmed' && item.creditsGranted > 0;
  return (
    <div style={{ background: t.BG, borderRadius: 9, padding: '12px 14px', border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: t.TITLE, marginBottom: 6 }}>{submissionLabel(item)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: showCredits ? 6 : 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: sc, background: `${sc}15`, padding: '1px 8px', borderRadius: 20 }}>{statusLabel(item.status)}</span>
        <span style={{ fontSize: 11, color: t.MUTED }}>{shortDate(item.createdAt)}</span>
      </div>
      {showCredits && <div style={{ fontSize: 12, color: t.ACCENT, fontWeight: 600 }}>+{item.creditsGranted.toLocaleString()} SC received</div>}
    </div>
  );
}

// The history list body (without the section header), used in the desktop right rail and the
// phone-width history tab. Renders the private-contributions note under the list.
export function ContributionsHistoryList({ submissions, t }: { submissions: ContributionSubmission[]; t: ContributionsTokens }) {
  return (
    <>
      {submissions.map((item) => (
        <HistoryItem key={item.id} item={item} t={t} />
      ))}
      <div style={{ marginTop: 8, padding: 12, background: `${t.ACCENT}08`, borderRadius: 9, border: `1px solid ${t.ACCENT}20` }}>
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>{PRIVACY_NOTE}</div>
      </div>
    </>
  );
}

/**
 * Empty-history composition (no contributions yet). `onContribute` switches the caller to the
 * contribute view — supply it only where that leads somewhere (the mobile tabbed layout, where the
 * contribute options live on a separate tab). Omit it on desktop, where the contribute cards are
 * already on the same screen, so we don't show a button that points at what's already visible.
 */
export function ContributionsEmptyHistory({ t, onContribute }: { t: ContributionsTokens; onContribute?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Inbox size={26} color={t.ACCENT} style={{ opacity: 0.6 }} />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600, color: t.TITLE }}>No contributions yet</h3>
      <p style={{ margin: onContribute ? '0 0 24px' : 0, fontSize: 13, color: t.MUTED, lineHeight: 1.7, maxWidth: 380 }}>
        If you&apos;re able to help, there are three ways to do it — a gift card, a Quora comment, or a GitHub star. The platform stays free either way.
      </p>
      {onContribute ? (
        <button
          type="button"
          onClick={onContribute}
          style={{ padding: '10px 28px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          See how to contribute
        </button>
      ) : null}
    </div>
  );
}
