'use client';

import { useState } from 'react';
import {
  QUORA_CENSUS_ACCOUNT_STATE,
  QUORA_CENSUS_ACCOUNT_STATE_LABEL,
  QUORA_CENSUS_STANCE,
  QUORA_CENSUS_STANCE_LABEL,
  QUORA_CENSUS_TOPIC,
  QUORA_CENSUS_TOPIC_LABEL,
  type QuoraCensusTopic,
} from 'lib/quora-live-census/constants';
import type { CensusTokens } from './census-theme';
import { buttonStyle, cardStyle, inputStyle, labelStyle, mutedStyle } from './census-styles';

// Coding one observed account. Stance starts at "cannot tell": the coder has to choose a
// substantive category deliberately, so nothing joins a tally by default.

export type EntryDraft = {
  handle: string;
  profileUrl: string;
  accountState: string;
  stance: string;
  topics: QuoraCensusTopic[];
  approxAnswerCount: string;
  lastActiveYear: string;
  evidenceUrl: string;
  notes: string;
};

export function emptyEntryDraft(): EntryDraft {
  return {
    handle: '',
    profileUrl: '',
    accountState: 'live',
    stance: 'unclear',
    topics: [],
    approxAnswerCount: '',
    lastActiveYear: '',
    evidenceUrl: '',
    notes: '',
  };
}

function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function entryDraftToBody(draft: EntryDraft): Record<string, unknown> {
  return {
    handle: draft.handle.trim(),
    profileUrl: draft.profileUrl,
    accountState: draft.accountState,
    stance: draft.stance,
    topics: draft.topics,
    approxAnswerCount: optionalNumber(draft.approxAnswerCount),
    lastActiveYear: optionalNumber(draft.lastActiveYear),
    evidenceUrl: draft.evidenceUrl,
    notes: draft.notes,
  };
}

export function CensusEntryForm({
  tokens,
  disabled,
  onSubmit,
}: {
  tokens: CensusTokens;
  disabled: boolean;
  onSubmit: (draft: EntryDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<EntryDraft>(emptyEntryDraft());
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<EntryDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const submit = async () => {
    setBusy(true);
    const saved = await onSubmit(draft);
    setBusy(false);
    if (saved) setDraft(emptyEntryDraft());
  };

  const toggleTopic = (topic: QuoraCensusTopic, checked: boolean) => {
    set({ topics: checked ? [...draft.topics, topic] : draft.topics.filter((t) => t !== topic) });
  };

  return (
    <section style={cardStyle(tokens)}>
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', color: tokens.TITLE }}>
        Code an account
      </h3>
      <p style={mutedStyle(tokens)}>
        One row per account you looked at, including the ones that do not fit the expectation —
        those are what make the run worth citing.
      </p>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="census-handle" style={labelStyle(tokens)}>Handle</label>
        <input
          id="census-handle"
          type="text"
          value={draft.handle}
          onChange={(event) => set({ handle: event.target.value })}
          style={inputStyle(tokens)}
          autoComplete="off"
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="census-profile" style={labelStyle(tokens)}>Profile link (optional)</label>
        <input
          id="census-profile"
          type="url"
          value={draft.profileUrl}
          onChange={(event) => set({ profileUrl: event.target.value })}
          style={inputStyle(tokens)}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="census-state" style={labelStyle(tokens)}>State when checked</label>
          <select
            id="census-state"
            value={draft.accountState}
            onChange={(event) => set({ accountState: event.target.value })}
            style={inputStyle(tokens)}
          >
            {QUORA_CENSUS_ACCOUNT_STATE.map((state) => (
              <option key={state} value={state}>{QUORA_CENSUS_ACCOUNT_STATE_LABEL[state]}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="census-year" style={labelStyle(tokens)}>Last active year (optional)</label>
          <input
            id="census-year"
            type="number"
            inputMode="numeric"
            value={draft.lastActiveYear}
            onChange={(event) => set({ lastActiveYear: event.target.value })}
            style={inputStyle(tokens)}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="census-stance" style={labelStyle(tokens)}>What the account says</label>
        <select
          id="census-stance"
          value={draft.stance}
          onChange={(event) => set({ stance: event.target.value })}
          style={inputStyle(tokens)}
        >
          {QUORA_CENSUS_STANCE.map((stance) => (
            <option key={stance} value={stance}>{QUORA_CENSUS_STANCE_LABEL[stance]}</option>
          ))}
        </select>
      </div>

      <fieldset style={{ marginTop: 12, border: 'none', padding: 0, minInlineSize: 0 }}>
        <legend style={{ ...labelStyle(tokens), padding: 0 }}>Subjects</legend>
        {QUORA_CENSUS_TOPIC.map((topic) => (
          <label
            key={topic}
            htmlFor={`census-topic-${topic}`}
            style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '5px 0', fontSize: 14, color: tokens.TEXT, cursor: 'pointer' }}
          >
            <input
              id={`census-topic-${topic}`}
              type="checkbox"
              checked={draft.topics.includes(topic)}
              onChange={(event) => toggleTopic(topic, event.target.checked)}
              style={{ accentColor: tokens.ACCENT }}
            />
            {QUORA_CENSUS_TOPIC_LABEL[topic]}
          </label>
        ))}
      </fieldset>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="census-answers" style={labelStyle(tokens)}>Roughly how many answers</label>
          <input
            id="census-answers"
            type="number"
            inputMode="numeric"
            value={draft.approxAnswerCount}
            onChange={(event) => set({ approxAnswerCount: event.target.value })}
            style={inputStyle(tokens)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="census-evidence" style={labelStyle(tokens)}>Archive link (optional)</label>
          <input
            id="census-evidence"
            type="url"
            value={draft.evidenceUrl}
            onChange={(event) => set({ evidenceUrl: event.target.value })}
            style={inputStyle(tokens)}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="census-notes" style={labelStyle(tokens)}>Notes (optional)</label>
        <textarea
          id="census-notes"
          rows={3}
          value={draft.notes}
          onChange={(event) => set({ notes: event.target.value })}
          style={{ ...inputStyle(tokens), resize: 'vertical' }}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={disabled || busy || draft.handle.trim().length === 0}
        style={{ ...buttonStyle(tokens, true), marginTop: 14 }}
      >
        {busy ? 'Saving…' : 'Add to run'}
      </button>
    </section>
  );
}
