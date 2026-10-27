'use client';

import { useState } from 'react';
import { CheckCircle, X, ChevronRight, Eye } from 'lucide-react';
import type { ContributionSubmissionAdminView, ContributionsRuntimeConfig } from '@/lib/contributions/types';
import {
  shortDate,
  statusColor,
  statusLabel,
  submissionLabel,
  type ContributionsTokens,
} from '../contributions-shared';
import { revealCode, type QueueFilter } from './contributions-admin-shared';

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

function initialConfirmedValue(row: ContributionSubmissionAdminView): string {
  return String(row.confirmedAmountUsd ?? row.claimedAmountUsd ?? '');
}

function resultingCredits(confirmedValue: string, config: ContributionsRuntimeConfig | null): number {
  const creditsPerUsd = config?.creditsPerUsd ?? 10;
  const numericValue = Number(confirmedValue);
  return Number.isFinite(numericValue) ? Math.round(numericValue * creditsPerUsd) : 0;
}

// The code is read only when the admin asks, one claim at a time, and each read is audited. It is
// erased on review, so a reviewed claim has none to show.
function CodeRow({ t, row }: { t: ContributionsTokens; row: ContributionSubmissionAdminView }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!row.hasCode) {
    return <div style={{ marginBottom: 12, fontSize: 12, color: t.MUTED }}>No code is stored for this claim.</div>;
  }

  async function show() {
    setBusy(true);
    setError(null);
    try {
      setCode(await revealCode(row.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The code could not be read.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {code ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <code style={{ fontSize: 15, letterSpacing: 1, color: t.TITLE, userSelect: 'all' }}>{code}</code>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(code)}
            style={{ minHeight: 32, padding: '4px 12px', borderRadius: 7, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.TEXT, fontSize: 12, cursor: 'pointer' }}
          >
            Copy
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void show()}
          disabled={busy}
          style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '4px 12px', borderRadius: 7, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.TEXT, fontSize: 12, cursor: busy ? 'default' : 'pointer' }}
        >
          <Eye size={12} /> {busy ? 'Reading…' : 'Show gift card code'}
        </button>
      )}
      {error ? <div role="alert" style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>{error}</div> : null}
    </div>
  );
}

function ConfirmedValueRow({
  t,
  confirmedValue,
  setConfirmedValue,
  resultingSc,
  isPending,
}: {
  t: ContributionsTokens;
  confirmedValue: string;
  setConfirmedValue: (value: string) => void;
  resultingSc: number;
  isPending: boolean;
}) {
  // Dollars with no cents, 1 to 500; the server rejects anything else, so the rule is said here.
  return (
    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <label htmlFor="contrib-q-confirmed-value" style={{ fontSize: 11, color: t.MUTED, flexShrink: 0 }}>
        Amount redeemed (USD, 1–500, no cents)
      </label>
      <input id="contrib-q-confirmed-value" value={confirmedValue} onChange={(e) => setConfirmedValue(e.target.value)} inputMode="numeric" disabled={!isPending} style={inputStyle(t, 80)} />
      <span style={{ fontSize: 11, color: t.MUTED }}>→ {resultingSc.toLocaleString()} SC (granted on confirm, up to the 365-day limit). Confirm or reject erases the code.</span>
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
  const [confirmedValue, setConfirmedValue] = useState(initialConfirmedValue(row));
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
      {isPending ? <CodeRow t={t} row={row} /> : null}
      <ConfirmedValueRow t={t} confirmedValue={confirmedValue} setConfirmedValue={setConfirmedValue} resultingSc={resultingSc} isPending={isPending} />
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
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* A member id is one long unbroken string, so it has nowhere to wrap: without the
                        truncation below it runs past this column and paints over the status pill. */}
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.userId}</div>
                    <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {submissionLabel(row)} · {claimedValueLabel(row)} · {shortDate(row.createdAt)}
                    </div>
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
