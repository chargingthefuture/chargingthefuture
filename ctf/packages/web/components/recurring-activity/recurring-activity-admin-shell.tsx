'use client';

import { useCallback, useEffect, useState } from 'react';
import { Repeat, Users, Zap } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { RefreshButton } from '@/components/shared/refresh-button';

// Admin dark palette (rule 131) with the Recurring Activity accent.
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#9CA3AF';
const FAINT = '#6B7280';
const ACCENT = '#14B8A6';

type ReciprocalPair = { userA: string; userB: string; activityIds: string[] };
type FastConfirmation = {
  activityId: string;
  ownerUserId: string;
  counterpartyUserId: string;
  secondsToConfirm: number;
};
type TightCluster = { memberUserIds: string[]; arrangementCount: number; density: number };

type Review = {
  activeArrangementCount: number;
  reciprocalPairs: ReciprocalPair[];
  fastConfirmations: FastConfirmation[];
  tightClusters: TightCluster[];
  truncated: boolean;
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Section({
  title,
  icon,
  explanation,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  explanation: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {icon}
        <h2 style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: 0 }}>{title}</h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: count > 0 ? ACCENT : FAINT }}>{count}</span>
      </div>
      <p style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.55, margin: '0 0 10px' }}>{explanation}</p>
      {count === 0 ? (
        <div style={{ fontSize: 12, color: FAINT, padding: '10px 14px', borderRadius: 10, border: `1px dashed ${BORDER}` }}>
          Nothing to look at here.
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function RecurringActivityAdminShell() {
  const [review, setReview] = useState<Review | null>(null);
  const [names, setNames] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recurring-activity/admin/review', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        review?: Review;
        names?: Record<string, string | null>;
      };
      if (!res.ok || !data.ok || !data.review) {
        setError(data.message ?? 'Could not load the review.');
        return;
      }
      setReview(data.review);
      setNames(data.names ?? {});
    } catch {
      setError('Could not load the review.');
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // A member with no resolvable name still has to be identifiable, so fall back to a short id rather
  // than an empty space.
  const nameOf = (userId: string) => names[userId] ?? `${userId.slice(0, 10)}…`;

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <MobileScreenHeader title="Recurring Activity Review" />
      <div style={{ padding: '16px 16px 40px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6, margin: 0 }}>
            A recurring arrangement only counts once the other member confirms it, which stops anyone
            inflating their own standing on their own — but not a small group confirming each other.
            These are the three shapes that pattern makes. Every one of them is a question, not a
            finding: people in one town really do have several arrangements with each other. Read the
            rows, do not act on the counts.
          </p>
          {/* The shared control rather than the admin landing's: this shell loads its data client-side,
              so a server re-render would not re-pull it. */}
          <RefreshButton onRefresh={() => load(false)} title="Refresh review" color={ACCENT} />
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: SUBTLE, padding: '24px 0' }}>Loading…</div>
        ) : error ? (
          <div style={{ fontSize: 13, color: '#EF4444', padding: '24px 0' }}>{error}</div>
        ) : review ? (
          <>
            <Card>
              <div style={{ fontSize: 12, color: SUBTLE }}>Confirmed arrangements reviewed</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{review.activeArrangementCount.toLocaleString()}</div>
              {review.truncated ? (
                <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 6 }}>
                  Only the most recent arrangements were read — this is a partial picture, not the whole one.
                </div>
              ) : null}
            </Card>

            <Section
              title="Each declared one with the other"
              icon={<Repeat size={15} style={{ color: ACCENT }} />}
              explanation="Two members who each recorded an arrangement naming the other. One arrangement between two people is ordinary; a matched pair, one in each direction, is what a trade of confirmations looks like."
              count={review.reciprocalPairs.length}
            >
              {review.reciprocalPairs.map((pair) => (
                <Card key={`${pair.userA}-${pair.userB}`}>
                  <div style={{ fontSize: 13, color: TEXT }}>{nameOf(pair.userA)} ↔ {nameOf(pair.userB)}</div>
                  <div style={{ fontSize: 11, color: FAINT, marginTop: 2 }}>
                    {pair.activityIds.length} arrangement{pair.activityIds.length === 1 ? '' : 's'} between them
                  </div>
                </Card>
              ))}
            </Section>

            <Section
              title="Confirmed within a minute"
              icon={<Zap size={15} style={{ color: ACCENT }} />}
              explanation="Arrangements confirmed within a minute of being declared — fast enough that nobody plausibly read what they were agreeing to. Two people sitting together can legitimately be this quick, so this only earns a second look, never a conclusion."
              count={review.fastConfirmations.length}
            >
              {review.fastConfirmations.map((row) => (
                <Card key={row.activityId}>
                  <div style={{ fontSize: 13, color: TEXT }}>{nameOf(row.ownerUserId)} → {nameOf(row.counterpartyUserId)}</div>
                  <div style={{ fontSize: 11, color: FAINT, marginTop: 2 }}>
                    confirmed after {row.secondsToConfirm} second{row.secondsToConfirm === 1 ? '' : 's'}
                  </div>
                </Card>
              ))}
            </Section>

            <Section
              title="Small groups pointing at each other"
              icon={<Users size={15} style={{ color: ACCENT }} />}
              explanation="Groups of three to eight members whose confirmed arrangements loop back within the group — more arrangements than members, which a simple chain of introductions can never produce. Bigger groups are left out on purpose: that is a community, not a ring."
              count={review.tightClusters.length}
            >
              {review.tightClusters.map((cluster) => (
                <Card key={cluster.memberUserIds.join('-')}>
                  <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                    {cluster.memberUserIds.map((id) => nameOf(id)).join(', ')}
                  </div>
                  <div style={{ fontSize: 11, color: FAINT, marginTop: 2 }}>
                    {cluster.memberUserIds.length} members · {cluster.arrangementCount} arrangements between them
                  </div>
                </Card>
              ))}
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}
