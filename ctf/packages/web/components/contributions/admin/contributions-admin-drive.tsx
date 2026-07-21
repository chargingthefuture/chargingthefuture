'use client';

import { useState } from 'react';
import { DollarSign, MessageSquare, Star, Calendar, Save } from 'lucide-react';
import type { ContributionsCycle } from '@/lib/contributions/types';
import type { ContributionsTokens } from '../contributions-shared';

export type DriveProps = {
  t: ContributionsTokens;
  cycle: ContributionsCycle | null;
  saving: boolean;
  error: string | null;
  onSave: (input: { cycleId: string | null; startsAt: string; endsAt: string; fiatGoalUsd: number; quoraCommentGoal: number; githubStarGoal: number }) => void;
  isMobile: boolean;
};

function toDateInput(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toISOString().slice(0, 10);
}

function fieldStyle(t: ContributionsTokens, width?: number | string): React.CSSProperties {
  return {
    width: width ?? '100%',
    padding: '9px 12px',
    background: t.BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    fontSize: 13,
    color: t.TEXT,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

/**
 * Drive management: the active cycle's window (start/end) and the three goals. Saving an existing
 * cycle issues a PUT; with no cycle yet it creates one. The drive "name" in the mockup has no
 * backing field in the cycle model, so it is intentionally omitted (rule 126 — no UI for data the
 * backend does not store).
 */
export function ContributionsAdminDrive({ t, cycle, saving, error, onSave }: DriveProps) {
  const [startsAt, setStartsAt] = useState(toDateInput(cycle?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toDateInput(cycle?.endsAt ?? null));
  const [fiatGoal, setFiatGoal] = useState(String(cycle?.fiatGoalUsd ?? ''));
  const [quoraGoal, setQuoraGoal] = useState(String(cycle?.quoraCommentGoal ?? ''));
  const [starGoal, setStarGoal] = useState(String(cycle?.githubStarGoal ?? ''));

  function save() {
    onSave({
      cycleId: cycle?.id ?? null,
      startsAt: startsAt ? new Date(`${startsAt}T00:00:00Z`).toISOString() : '',
      endsAt: endsAt ? new Date(`${endsAt}T23:59:59Z`).toISOString() : '',
      fiatGoalUsd: Number(fiatGoal) || 0,
      quoraCommentGoal: Number(quoraGoal) || 0,
      githubStarGoal: Number(starGoal) || 0,
    });
  }

  const goals: { Icon: typeof DollarSign; label: string; value: string; set: (v: string) => void }[] = [
    { Icon: DollarSign, label: 'Funding target (USD)', value: fiatGoal, set: setFiatGoal },
    { Icon: MessageSquare, label: 'Quora comments', value: quoraGoal, set: setQuoraGoal },
    { Icon: Star, label: 'GitHub stars', value: starGoal, set: setStarGoal },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
      <div style={{ background: t.SURFACE, borderRadius: 12, padding: 16, border: `1px solid ${t.BORDER_SOLID}`, maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18 }}>
          <Calendar size={14} color={t.ACCENT} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.TITLE }}>{cycle ? 'Active drive' : 'Start a drive'}</span>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="contrib-drive-start" style={{ fontSize: 12, color: t.MUTED, display: 'block', marginBottom: 5 }}>Start date</label>
          <input id="contrib-drive-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={fieldStyle(t)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="contrib-drive-end" style={{ fontSize: 12, color: t.MUTED, display: 'block', marginBottom: 5 }}>End date</label>
          <input id="contrib-drive-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={fieldStyle(t)} />
        </div>
        <div style={{ marginTop: 6, paddingTop: 16, borderTop: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 14 }}>Goals</div>
          {goals.map(({ Icon, label, value, set }) => (
            // On mobile the label + fixed-width input overflowed the card (the 180px label could not
            // shrink), so stack the label over a full-width input on phones; desktop keeps the inline row.
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 5, marginBottom: 14 }}>
              <label htmlFor={`contrib-goal-${label.replace(/\s+/g, '-')}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.MUTED, width: 'auto', flexShrink: 0 }}>
                <Icon size={13} color={t.MUTED} style={{ flexShrink: 0 }} />
                {label}
              </label>
              <input id={`contrib-goal-${label.replace(/\s+/g, '-')}`} value={value} onChange={(e) => set(e.target.value)} inputMode="numeric" style={fieldStyle(t, '100%')} />
            </div>
          ))}
        </div>
        {error && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 12 }}>{error}</div>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          <Save size={13} /> {saving ? 'Saving…' : 'Save drive'}
        </button>
      </div>
    </div>
  );
}
