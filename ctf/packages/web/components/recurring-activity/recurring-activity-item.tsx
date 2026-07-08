'use client';

import { useState } from 'react';
import {
  CADENCE_LABEL,
  SECTOR_LABEL,
  STATUS_LABEL,
  VISIBILITY_LABEL,
  currencyLabel,
  scValueLabel,
  statusColor,
  type Activity,
  type Currency,
  type RecurringActivityTokens,
  type RecurringActivityVisibility,
} from './recurring-activity-shared';

const VISIBILITY_ORDER: RecurringActivityVisibility[] = ['private', 'restricted', 'public'];

type ActionKind = 'confirm' | 'decline' | 'end' | 'visibility';

export function RecurringActivityItem({
  activity,
  currencies,
  t,
  busyAction,
  onConfirm,
  onDecline,
  onEnd,
  onVisibility,
}: {
  activity: Activity;
  currencies: Currency[];
  t: RecurringActivityTokens;
  busyAction: ActionKind | null;
  onConfirm: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onVisibility: (visibility: RecurringActivityVisibility) => void;
}) {
  const [visDraft, setVisDraft] = useState<RecurringActivityVisibility>(activity.visibility);

  const withName = activity.counterpartyName ? `with ${activity.counterpartyName}` : 'with a member';
  const scLine = scValueLabel(activity, currencies);
  const isCounterpartyPending = activity.status === 'pending' && activity.role === 'counterparty';
  const canEnd = activity.status === 'pending' || activity.status === 'active';
  const isOwner = activity.role === 'owner';
  const busy = busyAction !== null;

  return (
    <div
      style={{
        background: t.SURFACE,
        border: `1px solid ${t.BORDER_SOLID}`,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>{withName}</div>
          <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.6 }}>
            {SECTOR_LABEL[activity.sector]} · {currencyLabel(activity.currencyCode, currencies)} ·{' '}
            {CADENCE_LABEL[activity.cadence]}
          </div>
          {scLine ? <div style={{ fontSize: 13, color: t.TEXT, marginTop: 4 }}>{scLine}</div> : null}
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 999,
            color: statusColor(activity.status, t),
            background: `${statusColor(activity.status, t)}1A`,
            whiteSpace: 'nowrap',
          }}
        >
          {STATUS_LABEL[activity.status]}
        </span>
      </div>

      {(isCounterpartyPending || canEnd || isOwner) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${t.BORDER_SOLID}`,
          }}
        >
          {isCounterpartyPending && (
            <>
              <button type="button" disabled={busy} onClick={onConfirm} style={primaryBtn(t, busy)}>
                {busyAction === 'confirm' ? 'Confirming…' : 'Confirm'}
              </button>
              <button type="button" disabled={busy} onClick={onDecline} style={ghostBtn(t, busy)}>
                {busyAction === 'decline' ? 'Declining…' : 'Decline'}
              </button>
            </>
          )}
          {canEnd && (
            <button type="button" disabled={busy} onClick={onEnd} style={ghostBtn(t, busy)}>
              {busyAction === 'end' ? 'Ending…' : 'End activity'}
            </button>
          )}
          {isOwner && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: 12, color: t.MUTED }}>Visible to</span>
              <select
                aria-label="Who can see this activity"
                value={visDraft}
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value as RecurringActivityVisibility;
                  setVisDraft(next);
                  onVisibility(next);
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 8,
                  fontSize: 12,
                  color: t.TEXT,
                  background: t.INPUT_BG,
                  border: `1px solid ${t.BORDER_STRONG}`,
                  appearance: 'auto',
                }}
              >
                {VISIBILITY_ORDER.map((v) => (
                  <option key={v} value={v} style={{ color: t.BG }}>
                    {VISIBILITY_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function primaryBtn(t: RecurringActivityTokens, busy: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    background: t.ACCENT,
    border: 'none',
    color: t.BG,
    fontSize: 13,
    fontWeight: 700,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.7 : 1,
    fontFamily: 'inherit',
  };
}

function ghostBtn(t: RecurringActivityTokens, busy: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    background: 'transparent',
    border: `1px solid ${t.BORDER_STRONG}`,
    color: t.SUBTLE,
    fontSize: 13,
    fontWeight: 600,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.7 : 1,
    fontFamily: 'inherit',
  };
}
