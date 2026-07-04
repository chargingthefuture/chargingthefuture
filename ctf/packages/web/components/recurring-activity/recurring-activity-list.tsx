'use client';

import { HeartHandshake } from 'lucide-react';
import { RecurringActivityItem } from './recurring-activity-item';
import type {
  Activity,
  Currency,
  RecurringActivityTokens,
  RecurringActivityVisibility,
} from './recurring-activity-shared';

type ActionKind = 'confirm' | 'decline' | 'end' | 'visibility';

export function RecurringActivityList({
  activities,
  currencies,
  t,
  busy,
  onConfirm,
  onDecline,
  onEnd,
  onVisibility,
}: {
  activities: Activity[];
  currencies: Currency[];
  t: RecurringActivityTokens;
  busy: { id: string; action: ActionKind } | null;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onEnd: (id: string) => void;
  onVisibility: (id: string, visibility: RecurringActivityVisibility) => void;
}) {
  if (activities.length === 0) {
    return <RecurringActivityEmpty t={t} />;
  }
  return (
    <div>
      {activities.map((activity) => (
        <RecurringActivityItem
          key={activity.id}
          activity={activity}
          currencies={currencies}
          t={t}
          busyAction={busy && busy.id === activity.id ? busy.action : null}
          onConfirm={() => onConfirm(activity.id)}
          onDecline={() => onDecline(activity.id)}
          onEnd={() => onEnd(activity.id)}
          onVisibility={(visibility) => onVisibility(activity.id, visibility)}
        />
      ))}
    </div>
  );
}

export function RecurringActivityEmpty({ t }: { t: RecurringActivityTokens }) {
  return (
    <div
      style={{
        border: `1px dashed ${t.BORDER_SOLID}`,
        borderRadius: 14,
        padding: '32px 24px',
        textAlign: 'center',
      }}
    >
      <HeartHandshake size={26} color={t.ACCENT} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 6 }}>
        No ongoing activities yet
      </div>
      <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.7, margin: '0 auto', maxWidth: 340 }}>
        When you share something ongoing with another member — a home, a service, a standing favor —
        you can acknowledge it here. It stays private unless you choose otherwise.
      </p>
    </div>
  );
}
