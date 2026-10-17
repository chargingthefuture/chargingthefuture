'use client';

// The milestone queue on the SkillUp admin panel (#2931). Two lists: credits waiting to move for
// milestones already signed off, then milestones waiting on a sign-off. Before this the panel listed
// only 'pending' validation rows, which nothing writes, so the Validate and Release buttons never
// showed and no screen could sign off a milestone.
import type { SkillUpTokens } from './su-shared';
import type { AdminMilestoneQueueItem } from './su-admin-shared';
import { ValidationActions } from './su-review-actions';

function learnerLabel(item: AdminMilestoneQueueItem): string {
  return item.learnerName ? `@${item.learnerName}` : `member ${item.learnerUserId.slice(0, 10)}`;
}

function formatQueuedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function QueueRow({ item, t, onChanged }: { item: AdminMilestoneQueueItem; t: SkillUpTokens; onChanged: () => void }) {
  return (
    <div style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>{item.milestoneName || `Milestone ${item.sequenceNo}`}</span>
        <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>{formatQueuedAt(item.queuedAtIso)}</span>
      </div>
      <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4 }}>
        {learnerLabel(item)} · {item.cohortTitle || 'Untitled cohort'}
      </div>
      {item.requiredTask ? (
        <p style={{ fontSize: 13, color: t.TEXT_BODY, margin: '6px 0 0', lineHeight: 1.5 }}>{item.requiredTask}</p>
      ) : null}
      {item.validationNote ? (
        <p style={{ fontSize: 13, color: '#D1D5DB', margin: '6px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.validationNote}</p>
      ) : null}
      <ValidationActions item={item} t={t} onDone={onChanged} />
    </div>
  );
}

function QueueList({ title, emptyText, items, t, onChanged }: {
  title: string;
  emptyText: string;
  items: AdminMilestoneQueueItem[];
  t: SkillUpTokens;
  onChanged: () => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>
        {title} {items.length > 0 ? `(${items.length})` : ''}
      </h2>
      {items.length === 0 ? (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: t.MUTED, fontSize: 13, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          {emptyText}
        </div>
      ) : (
        items.map((item) => <QueueRow key={`${item.enrollmentId}-${item.milestoneId}`} item={item} t={t} onChanged={onChanged} />)
      )}
    </div>
  );
}

export function MilestoneQueueSection({ milestoneQueue, t, onChanged }: {
  milestoneQueue: AdminMilestoneQueueItem[];
  t: SkillUpTokens;
  onChanged: () => void;
}) {
  const awaitingRelease = milestoneQueue.filter((item) => item.stage === 'awaiting_release');
  const awaitingValidation = milestoneQueue.filter((item) => item.stage === 'awaiting_validation');
  return (
    <>
      <QueueList
        title="Signed off, credits not released"
        emptyText="No milestones waiting on their credits."
        items={awaitingRelease}
        t={t}
        onChanged={onChanged}
      />
      <QueueList
        title="Milestones waiting for sign-off"
        emptyText="No milestones waiting for sign-off."
        items={awaitingValidation}
        t={t}
        onChanged={onChanged}
      />
    </>
  );
}
