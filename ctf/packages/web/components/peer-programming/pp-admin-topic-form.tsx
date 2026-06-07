'use client';

// Weekly topic guidance editor for the Peer Programming admin surface.
// Binds PUT /api/peer-programming/admin/topics (upsert). The endpoint requires
// weekStartDate, title, and guidance; `publish` toggles draft vs published.
import { useState } from 'react';
import type { PeerProgrammingTopic } from './pp-admin-shared';

type TopicDraft = {
  weekStartDate: string;
  title: string;
  guidance: string;
  revisionNote: string;
  publish: boolean;
};

function draftFromTopic(topic: PeerProgrammingTopic | null, defaultWeekStart: string): TopicDraft {
  return {
    weekStartDate: topic?.weekStartDate ?? defaultWeekStart,
    title: topic?.title ?? '',
    guidance: topic?.guidance ?? '',
    revisionNote: topic?.revisionNote ?? '',
    publish: topic?.status === 'published',
  };
}

export function PeerProgrammingAdminTopicForm({
  topic,
  defaultWeekStart,
  busy,
  isMobile,
  onSubmit,
}: {
  topic: PeerProgrammingTopic | null;
  defaultWeekStart: string;
  busy: boolean;
  isMobile: boolean;
  onSubmit: (draft: TopicDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<TopicDraft>(() => draftFromTopic(topic, defaultWeekStart));

  const canSubmit =
    draft.weekStartDate.trim().length > 0 &&
    draft.title.trim().length > 0 &&
    draft.guidance.trim().length > 0 &&
    !busy;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        void onSubmit({
          ...draft,
          weekStartDate: draft.weekStartDate.trim(),
          title: draft.title.trim(),
          guidance: draft.guidance.trim(),
          revisionNote: draft.revisionNote.trim(),
        });
      }}
    >
      <div className={isMobile ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2'}>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Week start date</span>
          <input
            type="date"
            required
            value={draft.weekStartDate}
            onChange={(event) => setDraft((prev) => ({ ...prev, weekStartDate: event.target.value }))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <span className="block text-xs text-muted-foreground">
            Use the Monday of the target week. The room shows the topic for the current week only.
          </span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            type="text"
            required
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="This week's focus"
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Guidance</span>
        <textarea
          required
          value={draft.guidance}
          onChange={(event) => setDraft((prev) => ({ ...prev, guidance: event.target.value }))}
          className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="What should cohorts work on together this week?"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Revision note (optional)</span>
        <input
          type="text"
          value={draft.revisionNote}
          onChange={(event) => setDraft((prev) => ({ ...prev, revisionNote: event.target.value }))}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Why this guidance changed"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.publish}
          onChange={(event) => setDraft((prev) => ({ ...prev, publish: event.target.checked }))}
          className="h-4 w-4"
        />
        <span>Publish (visible to cohorts). Leave unchecked to save as a draft.</span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {busy ? 'Saving…' : draft.publish ? 'Save and publish' : 'Save draft'}
      </button>
    </form>
  );
}
