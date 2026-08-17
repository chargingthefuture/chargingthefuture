'use client';

import { useState } from 'react';
import { CheckCircle, X, ChevronRight } from 'lucide-react';
import type { ContributionSubmissionAdminView, ContributionsRuntimeConfig } from '@/lib/contributions/types';
import {
  shortDate,
  statusColor,
  statusLabel,
  submissionLabel,
  type ContributionsTokens,
} from '../contributions-shared';
import type { QueueFilter } from './contributions-admin-shared';

const FILTERS: { key: QueueFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'rejected', label: 'Rejected' },
];

type ReviewInput = { action: 'confirm' | 'reject'; confirmedAmountUsd?: number; reviewNote?: string };

export type QueueProps = {
  t: ContributionsTokens;
  config: ContributionsRuntimeConfig | null;
  submissions: ContributionSubmissionAdminView[];
  filter: QueueFilter;
  onFilter: (filter: QueueFilter) => void;
  search: string;
  onSearch: (value: string) => void;
  reviewing: string | null;
  onReview: (submissionId: string, input: ReviewInput) => void;
  isMobile: boolean;
};

function inputStyle(t: ContributionsTokens, width?: number | string): React.CSSProperties {
  return {
    width: width ?? '100%',
    padding: '7px 10px',
    background: t.BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 7,
    fontSize: 12,
    color: t.TEXT,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function initialUrl(row: ContributionSubmissionAdminView): string {
  return row.quoraPostUrl ?? row.githubProfileUrl ?? '';
}

function initialConfirmedValue(
  row: ContributionSubmissionAdminView,
  config: ContributionsRuntimeConfig | null,
  isGiftCard: boolean,
): string {
  if (row.confirmedAmountUsd != null) {
    return String(row.confirmedAmountUsd);
  }
  if (isGiftCard) {
    return String(row.claimedAmountUsd ?? '');
  }
  return String(config?.nonMonetaryUnitValueUsd ?? 1);
}

function resultingCredits(confirmedValue: string, config: ContributionsRuntimeConfig | null): number {
  const creditsPerUsd = config?.creditsPerUsd ?? 10;
  const numericValue = Number(confirmedValue);
  return Number.isFinite(numericValue) ? Math.round(numericValue * creditsPerUsd) : 0;
}

function ReviewUrlField({
  t,
  row,
  urlField,
  setUrlField,
  isPending,
}: {
  t: ContributionsTokens;
  row: ContributionSubmissionAdminView;
  urlField: string;
  setUrlField: (value: string) => void;
  isPending: boolean;
}) {
  const isQuora = row.kind === 'quora_comment';
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: t.MUTED, display: 'block', marginBottom: 5 }}>
        {isQuora ? 'Quora post URL (editable — paste from notifications)' : 'GitHub profile URL (editable — paste from notifications)'}
      </label>
      <input
        value={urlField}
        onChange={(e) => setUrlField(e.target.value)}
        placeholder={isQuora ? 'https://quora.com/…' : 'https://github.com/…'}
        disabled={!isPending}
        style={inputStyle(t, 400)}
      />
    </div>
  );
}

function ConfirmedValueRow({
  t,
  confirmedValue,
  setConfirmedValue,
  resultingSc,
  isPending,
  isGiftCard,
}: {
  t: ContributionsTokens;
  confirmedValue: string;
  setConfirmedValue: (value: string) => void;
  resultingSc: number;
  isPending: boolean;
  isGiftCard: boolean;
}) {
  // Gift cards are whole dollars, 1 to 500, and the server rejects anything else — so say the rule
  // here rather than letting the admin find it on submit. A comment or star has no such rule: the
  // field carries the configured USD-equivalent, which is free to be fractional.
  return (
    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <label htmlFor="contrib-q-confirmed-value" style={{ fontSize: 11, color: t.MUTED, flexShrink: 0 }}>
        {isGiftCard ? 'Confirmed value (whole USD, 1–500)' : 'Confirmed value (USD)'}
      </label>
      <input id="contrib-q-confirmed-value" value={confirmedValue} onChange={(e) => setConfirmedValue(e.target.value)} inputMode={isGiftCard ? 'numeric' : 'decimal'} disabled={!isPending} style={inputStyle(t, 80)} />
      <span style={{ fontSize: 11, color: t.MUTED }}>→ {resultingSc.toLocaleString()} SC (credits granted automatically, subject to per-cycle cap)</span>
    </div>
  );
}

function ReviewNoteRow({
  t,
  note,
  setNote,
  isPending,
}: {
  t: ContributionsTokens;
  note: string;
  setNote: (value: string) => void;
  isPending: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor="contrib-q-note" style={{ fontSize: 11, color: t.MUTED, display: 'block', marginBottom: 5 }}>Note (optional)</label>
      <input id="contrib-q-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note…" disabled={!isPending} style={inputStyle(t, 400)} />
    </div>
  );
}

function ReviewActions({
  t,
  row,
  reviewing,
  isPending,
  confirm,
  reject,
}: {
  t: ContributionsTokens;
  row: ContributionSubmissionAdminView;
  reviewing: boolean;
  isPending: boolean;
  confirm: () => void;
  reject: () => void;
}) {
  if (!isPending) {
    return (
      <div style={{ fontSize: 12, color: t.MUTED }}>
        Already reviewed{row.reviewNote ? ` — ${row.reviewNote}` : ''}.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={confirm}
        disabled={reviewing}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 7, background: '#22C55E', border: 'none', color: '#000', fontSize: 12, fontWeight: 600, cursor: reviewing ? 'default' : 'pointer', opacity: reviewing ? 0.6 : 1 }}
      >
        <CheckCircle size={12} /> Confirm
      </button>
      <button
        type="button"
        onClick={reject}
        disabled={reviewing}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 7, background: 'transparent', border: '1px solid #EF4444', color: '#EF4444', fontSize: 12, cursor: reviewing ? 'default' : 'pointer', opacity: reviewing ? 0.6 : 1 }}
      >
        <X size={12} /> Reject
      </button>
    </div>
  );
}

function ReviewPanel({
  t,
  config,
  row,
  reviewing,
  onReview,
}: {
  t: ContributionsTokens;
  config: ContributionsRuntimeConfig | null;
  row: ContributionSubmissionAdminView;
  reviewing: boolean;
  onReview: (submissionId: string, input: ReviewInput) => void;
}) {
  const isGiftCard = row.kind === 'gift_card';
  const isUrlKind = row.kind === 'quora_comment' || row.kind === 'github_star';
  const [urlField, setUrlField] = useState(initialUrl(row));
  const [confirmedValue, setConfirmedValue] = useState(initialConfirmedValue(row, config, isGiftCard));
  const [note, setNote] = useState(row.reviewNote ?? '');

  const resultingSc = resultingCredits(confirmedValue, config);
  const isPending = row.status === 'pending';

  function confirm() {
    const amount = Number(confirmedValue);
    onReview(row.id, {
      action: 'confirm',
      confirmedAmountUsd: Number.isFinite(amount) ? amount : undefined,
      reviewNote: note.trim() ? note.trim() : undefined,
    });
  }

  function reject() {
    onReview(row.id, { action: 'reject', reviewNote: note.trim() ? note.trim() : undefined });
  }

  return (
    <div style={{ padding: '14px 24px 18px 36px', background: `${t.ACCENT}05`, borderTop: `1px solid ${t.BORDER_SOLID}` }}>
      {isUrlKind && (
        <ReviewUrlField t={t} row={row} urlField={urlField} setUrlField={setUrlField} isPending={isPending} />
      )}
      <ConfirmedValueRow t={t} confirmedValue={confirmedValue} setConfirmedValue={setConfirmedValue} resultingSc={resultingSc} isPending={isPending} isGiftCard={isGiftCard} />
      <ReviewNoteRow t={t} note={note} setNote={setNote} isPending={isPending} />
      <ReviewActions t={t} row={row} reviewing={reviewing} isPending={isPending} confirm={confirm} reject={reject} />
    </div>
  );
}

function claimedValueLabel(row: ContributionSubmissionAdminView): string {
  if (row.kind === 'gift_card' && row.claimedAmountUsd != null) {
    return `$${row.claimedAmountUsd.toLocaleString()}`;
  }
  return '—';
}

export function ContributionsAdminQueue(props: QueueProps) {
  const { t, config, submissions, filter, onFilter, search, reviewing, onReview } = props;
  const [expandId, setExpandId] = useState<string | null>(null);

  const searched = search.trim().toLowerCase();
  const visible = searched
    ? submissions.filter((r) => r.userId.toLowerCase().includes(searched) || submissionLabel(r).toLowerCase().includes(searched))
    : submissions;

  const filterBar = (
    <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${t.BORDER_SOLID}`, flexWrap: 'wrap' }}>
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onFilter(f.key)}
          style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, background: filter === f.key ? t.ACCENT : t.BORDER_SOLID, color: filter === f.key ? '#fff' : t.MUTED, whiteSpace: 'nowrap' }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {filterBar}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visible.length === 0 && <div style={{ padding: 24, fontSize: 13, color: t.MUTED }}>No submissions match this view.</div>}
        {visible.map((row) => {
          const expanded = expandId === row.id;
          const sc = statusColor(row.status, t);
          return (
            <div key={row.id} style={{ borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandId(expanded ? null : row.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandId(expanded ? null : row.id);
                  }
                }}
                style={{ padding: '12px 14px', cursor: 'pointer', background: expanded ? `${t.ACCENT}06` : 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>{row.userId}</span>
                    <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>
                      {submissionLabel(row)} · {claimedValueLabel(row)} · {shortDate(row.createdAt)}
                    </div>
                    {row.signalContact && <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Signal: {row.signalContact}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: sc, background: `${sc}15`, padding: '2px 8px', borderRadius: 20 }}>{statusLabel(row.status)}</span>
                    <ChevronRight size={14} color={t.MUTED} style={{ transform: expanded ? 'rotate(90deg)' : 'none' }} />
                  </div>
                </div>
              </div>
              {expanded && <ReviewPanel t={t} config={config} row={row} reviewing={reviewing === row.id} onReview={onReview} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
