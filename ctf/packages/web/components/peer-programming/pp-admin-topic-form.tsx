'use client';

// Weekly topic guidance editor for the PeerProgramming admin surface.
// Binds PUT /api/peer-programming/admin/topics (upsert). The endpoint requires
// weekStartDate, title, and guidance; `publish` toggles draft vs published.
import { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { PeerProgrammingTopic } from './pp-admin-shared';
import { getPeerProgrammingTokens, type PeerProgrammingTokens } from './pp-shared';

// Admin design tokens (shared admin look from the design system) come from the theme-aware
// PeerProgramming tokens: accent (mint), page background, title text, and the solid admin
// border. The default theme keeps the shipped hex values.

const inputStyle = (t: PeerProgrammingTokens): React.CSSProperties => ({
  width: '100%',
  // box-sizing keeps padding inside the width; minWidth:0 lets the field shrink inside its grid track
  // (grid/flex items default to min-width:auto, which is content-based). Without it an iOS
  // `<input type="date">` — whose native control has a wide intrinsic minimum — forces its column wider
  // than the phone and spills past the card. Normalizing the appearance stops the native date control
  // from imposing that intrinsic width.
  boxSizing: 'border-box',
  minWidth: 0,
  maxWidth: '100%',
  WebkitAppearance: 'none',
  appearance: 'none',
  background: t.BG,
  border: `1px solid ${t.BORDER_SOLID}`,
  color: t.TITLE,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
});

const labelTextStyle = (t: PeerProgrammingTokens): React.CSSProperties => ({
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: t.TITLE,
  marginBottom: 6,
});

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
  onSubmit,
}: {
  topic: PeerProgrammingTopic | null;
  defaultWeekStart: string;
  busy: boolean;
  isMobile: boolean;
  onSubmit: (draft: TopicDraft) => Promise<void>;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
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
          gridTemplateColumns: '1fr',
          gap: 16,
          minWidth: 0,
        }}
      >
        <label style={{ display: 'block', minWidth: 0 }}>
          <span style={labelTextStyle(t)}>Week start date</span>
          <input
            type="date"
            required
            value={draft.weekStartDate}
            onChange={(event) => setDraft((prev) => ({ ...prev, weekStartDate: event.target.value }))}
            style={inputStyle(t)}
          />
          <span style={{ display: 'block', fontSize: 11, color: t.MUTED, marginTop: 6, lineHeight: 1.5 }}>
            Use the Monday of the target week. The room shows the topic for the current week only.
          </span>
        </label>
        <label style={{ display: 'block', minWidth: 0 }}>
          <span style={labelTextStyle(t)}>Title</span>
          <input
            type="text"
            required
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            style={inputStyle(t)}
            placeholder="This week's focus"
          />
        </label>
      </div>

      <label style={{ display: 'block' }}>
        <span style={labelTextStyle(t)}>Guidance</span>
        <textarea
          required
          value={draft.guidance}
          onChange={(event) => setDraft((prev) => ({ ...prev, guidance: event.target.value }))}
          style={{ ...inputStyle(t), minHeight: 112, resize: 'vertical' }}
          placeholder="What should cohorts work on together this week?"
        />
      </label>

      <label style={{ display: 'block' }}>
        <span style={labelTextStyle(t)}>Revision note (optional)</span>
        <input
          type="text"
          value={draft.revisionNote}
          onChange={(event) => setDraft((prev) => ({ ...prev, revisionNote: event.target.value }))}
          style={inputStyle(t)}
          placeholder="Why this guidance changed"
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.TITLE, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={draft.publish}
          onChange={(event) => setDraft((prev) => ({ ...prev, publish: event.target.checked }))}
          style={{ width: 16, height: 16, accentColor: t.ACCENT }}
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
          background: t.ACCENT,
          border: `1px solid ${t.ACCENT}`,
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
