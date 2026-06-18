'use client';

// Weekly topic guidance editor for the Peer Programming admin surface.
// Binds PUT /api/peer-programming/admin/topics (upsert). The endpoint requires
// weekStartDate, title, and guidance; `publish` toggles draft vs published.
import { useState } from 'react';
import type { PeerProgrammingTopic } from './pp-admin-shared';

// Admin design tokens (shared admin look from the design system). Peer Programming accent is mint.
const COLOR = '#6EE7B7';
const BG = '#0F1117';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: BG,
  border: `1px solid ${BORDER}`,
  color: TEXT,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
};

const labelTextStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: TEXT,
  marginBottom: 6,
};

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
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}
      >
        <label style={{ display: 'block' }}>
          <span style={labelTextStyle}>Week start date</span>
          <input
            type="date"
            required
            value={draft.weekStartDate}
            onChange={(event) => setDraft((prev) => ({ ...prev, weekStartDate: event.target.value }))}
            style={inputStyle}
          />
          <span style={{ display: 'block', fontSize: 11, color: SUBTLE, marginTop: 6, lineHeight: 1.5 }}>
            Use the Monday of the target week. The room shows the topic for the current week only.
          </span>
        </label>
        <label style={{ display: 'block' }}>
          <span style={labelTextStyle}>Title</span>
          <input
            type="text"
            required
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            style={inputStyle}
            placeholder="This week's focus"
          />
        </label>
      </div>

      <label style={{ display: 'block' }}>
        <span style={labelTextStyle}>Guidance</span>
        <textarea
          required
          value={draft.guidance}
          onChange={(event) => setDraft((prev) => ({ ...prev, guidance: event.target.value }))}
          style={{ ...inputStyle, minHeight: 112, resize: 'vertical' }}
          placeholder="What should cohorts work on together this week?"
        />
      </label>

      <label style={{ display: 'block' }}>
        <span style={labelTextStyle}>Revision note (optional)</span>
        <input
          type="text"
          value={draft.revisionNote}
          onChange={(event) => setDraft((prev) => ({ ...prev, revisionNote: event.target.value }))}
          style={inputStyle}
          placeholder="Why this guidance changed"
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TEXT, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={draft.publish}
          onChange={(event) => setDraft((prev) => ({ ...prev, publish: event.target.checked }))}
          style={{ width: 16, height: 16, accentColor: COLOR }}
        />
        <span>Publish (visible to cohorts). Leave unchecked to save as a draft.</span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 16px',
          borderRadius: 8,
          background: COLOR,
          border: `1px solid ${COLOR}`,
          color: '#0F1117',
          fontSize: 13,
          fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.5,
        }}
      >
        {busy ? 'Saving…' : draft.publish ? 'Save and publish' : 'Save draft'}
      </button>
    </form>
  );
}
