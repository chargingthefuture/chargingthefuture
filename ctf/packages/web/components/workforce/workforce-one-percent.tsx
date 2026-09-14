'use client';

import { useEffect, useState } from 'react';
import type { WorkforceTokens } from './workforce-shared';
import type {
  OnePercentCard,
  OnePercentRateRow,
  OnePercentReach,
  OnePercentRoute,
} from '@/lib/workforce/one-percent';

// What's Your 1% — the last tab on Workforce, and the only one about the member reading it.
//
// Every other tab answers what the population looks like. A member can read all of it and still
// believe none of it applies to them, because what was taken from them was taken inside another
// economy and it is easy to conclude the skill went with it. It did not. The skill is still there,
// and this screen does the arithmetic on what it could reach here.
//
// The card is deliberately a playing card: your initials, your name, your trade, your skills. It
// is yours, nobody else's is shown, and nothing on it is scored or ranked.

type Payload = {
  card: OnePercentCard;
  reach: OnePercentReach;
  ladder: OnePercentRateRow[];
  routes: OnePercentRoute[];
};

function usd(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

function Card({ card, t }: { card: OnePercentCard; t: WorkforceTokens }) {
  if (card.isUnclaimed) {
    return (
      <div style={{ background: t.SURFACE, border: `1px dashed ${t.BORDER}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.TEXT, marginBottom: 8 }}>
          Your card is not built yet
        </div>
        <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, margin: 0 }}>
          The card is made from your Directory listing — your name, your trade, and the skills on it.
          Claim your listing and it fills in. The arithmetic below does not depend on it and is the
          same for everybody.
        </p>
        <a
          href="/apps/directory"
          style={{ display: 'inline-block', marginTop: 14, color: t.ACCENT, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          Go to the Directory ›
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        background: t.SURFACE,
        border: `1px solid ${t.BORDER}`,
        borderRadius: 14,
        padding: 20,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: 12,
          background: `${t.ACCENT}22`,
          border: `1px solid ${t.ACCENT}`,
          color: t.ACCENT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        {card.initials}
      </div>
      <div style={{ minWidth: 0, flex: '1 1 220px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: t.TEXT }}>
          {[card.firstName, card.lastName].filter(Boolean).join(' ')}
        </div>
        {card.jobTitleName && (
          <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>{card.jobTitleName}</div>
        )}
        {card.skills.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {card.skills.map((skill) => (
              <span
                key={skill}
                style={{
                  fontSize: 11,
                  color: t.TEXT,
                  background: t.BG,
                  border: `1px solid ${t.BORDER}`,
                  borderRadius: 20,
                  padding: '3px 10px',
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, margin: '12px 0 0' }}>
            No skills listed yet. Add one to your Directory listing and it appears here.
          </p>
        )}
      </div>
    </div>
  );
}

function Ladder({ reach, ladder, t }: { reach: OnePercentReach; ladder: OnePercentRateRow[]; t: WorkforceTokens }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: t.TEXT, margin: '0 0 6px' }}>
        Reading it backwards
      </h3>
      <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, margin: '0 0 14px' }}>
        Pick the row closest to what you already charge one person, once, in a year. The column on
        the right is that rate across {reach.peopleReached.toLocaleString('en-US')} people.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 340 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: t.MUTED, fontSize: 11 }}>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Per person, per year</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Across your 1%</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>vs the average</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((row) => (
              <tr key={row.ratePerPersonUsd} style={{ borderTop: `1px solid ${t.BORDER}` }}>
                <td style={{ padding: '9px 8px', color: t.TEXT }}>{usd(row.ratePerPersonUsd)}</td>
                <td style={{ padding: '9px 8px', color: t.TEXT, fontWeight: 700 }}>{usd(row.annualUsd)}</td>
                <td style={{ padding: '9px 8px', color: t.MUTED }}>{row.multipleOfAverageEarnings}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.6, margin: '12px 0 0' }}>
        The average on the Overview tab — {usd(reach.averageContributionUsd)} contributed,{' '}
        {usd(reach.averageEarningsUsd)} earned — is an even split across everybody, and most people
        do not work full time. That is what makes it an average rather than a ceiling.
      </p>
    </div>
  );
}

function Routes({ routes, t }: { routes: OnePercentRoute[]; t: WorkforceTokens }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: t.TEXT, margin: '0 0 6px' }}>
        How a trade reaches that many people
      </h3>
      <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, margin: '0 0 14px' }}>
        Done only in person, one job at a time, no trade reaches 1% of five million people spread
        across the world. That ceiling is real, and it is a ceiling on one route rather than on the
        skill. Each of these is a different route for the same skill.
      </p>
      {routes.map((route, index) => (
        <div
          key={route.key}
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 0',
            borderTop: index === 0 ? 'none' : `1px solid ${t.BORDER}`,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <a
              href={route.href}
              style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, textDecoration: 'none' }}
            >
              {route.surface}
            </a>
            <div style={{ fontSize: 13, color: t.TEXT, lineHeight: 1.6, marginTop: 3 }}>{route.what}</div>
            <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginTop: 3 }}>{route.reach}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkforceOnePercent({ t }: { t: WorkforceTokens }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch('/api/workforce/one-percent', { signal: controller.signal });
        const body = (await res.json()) as Payload & { message?: string };
        if (!res.ok) throw new Error(body.message ?? 'Could not work out your 1%.');
        setData(body);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Could not work out your 1%.');
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div role="alert" style={{ padding: 20, fontSize: 13, color: '#EF4444' }}>
        {error}
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 20, fontSize: 13, color: t.MUTED }}>Loading…</div>;
  }

  const { card, reach, ladder, routes } = data;

  return (
    <div style={{ padding: '20px 16px 48px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: t.TEXT, margin: '0 0 6px' }}>
        What&rsquo;s your 1%?
      </h2>
      <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, margin: '0 0 20px' }}>
        One percent of the five million estimate is{' '}
        <strong style={{ color: t.TEXT }}>{reach.peopleReached.toLocaleString('en-US')} people</strong>.
        This is yours alone — nobody else sees it, and you see nobody else&rsquo;s.
      </p>

      <Card card={card} t={t} />
      <Ladder reach={reach} ladder={ladder} t={t} />
      <Routes routes={routes} t={t} />

      <p style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.6, margin: '28px 0 0' }}>
        These figures are speculative and are not a forecast of what you or anybody will earn. They
        are arithmetic on a stated share of a population estimate, shown so the shape of it is
        visible. What actually happens takes talent, work, and luck in some combination, and no
        screen can hand you those. What it can tell you is that the skill you have is still a skill,
        and that the number it could reach here is not small.
      </p>
    </div>
  );
}
