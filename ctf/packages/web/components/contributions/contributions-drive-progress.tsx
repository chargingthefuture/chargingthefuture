'use client';

import { DollarSign, MessageSquare, Star } from 'lucide-react';
import { GOAL_COLORS, progressPct, type ContributionsTokens } from './contributions-shared';
import type { FundraiserResponse } from './contributions-shared';

type Goal = {
  key: 'funding' | 'quora' | 'github';
  label: string;
  current: number;
  target: number;
  unit: string;
  Icon: typeof DollarSign;
  color: string;
};

export function goalsFromFundraiser(fundraiser: FundraiserResponse['fundraiser']): Goal[] {
  const cycle = fundraiser.cycle;
  return [
    {
      key: 'funding',
      label: 'Funding raised',
      current: fundraiser.fiatConfirmedUsd,
      target: cycle?.fiatGoalUsd ?? 0,
      unit: '$',
      Icon: DollarSign,
      color: GOAL_COLORS.funding,
    },
    {
      key: 'quora',
      label: 'Quora comments',
      current: fundraiser.quoraCommentsConfirmed,
      target: cycle?.quoraCommentGoal ?? 0,
      unit: '',
      Icon: MessageSquare,
      color: GOAL_COLORS.quora,
    },
    {
      key: 'github',
      label: 'GitHub stars',
      current: fundraiser.githubStarsConfirmed,
      target: cycle?.githubStarGoal ?? 0,
      unit: '',
      Icon: Star,
      color: GOAL_COLORS.github,
    },
  ];
}

// A single goal "card" (vertical layout used on desktop main + empty screens).
export function GoalCard({ goal, t }: { goal: Goal; t: ContributionsTokens }) {
  const pct = progressPct(goal.current, goal.target);
  const { Icon, color, label, current, target, unit } = goal;
  return (
    <div style={{ flex: 1, background: t.SURFACE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 12, color: t.MUTED }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 8 }}>
        {unit}
        {current.toLocaleString()}{' '}
        <span style={{ fontSize: 12, fontWeight: 400, color: t.MUTED }}>
          / {unit}
          {target.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 6, background: t.BORDER_SOLID, borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 5 }}>{pct}% toward goal</div>
    </div>
  );
}

// A single goal as a stacked row (used on the phone-width Drive tab).
export function GoalRow({ goal, t }: { goal: Goal; t: ContributionsTokens }) {
  const pct = progressPct(goal.current, goal.target);
  const { Icon, color, label, current, target, unit } = goal;
  return (
    <div style={{ background: t.SURFACE, borderRadius: 10, padding: '12px 14px', border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={13} color={color} />
          <span style={{ fontSize: 13, color: t.MUTED }}>{label}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {unit}
          {current.toLocaleString()} / {unit}
          {target.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 6, background: t.BORDER_SOLID, borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 5 }}>{pct}% toward goal</div>
    </div>
  );
}
