'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  QUORA_CENSUS_FRAME_KIND,
  QUORA_CENSUS_FRAME_KIND_LABEL,
  QUORA_CENSUS_FRAME_KIND_SUPPORTS,
  type QuoraCensusFrameKind,
} from 'lib/quora-live-census/constants';
import type { CensusRunSummary } from 'lib/quora-live-census/repository';
import type { CensusTokens } from './census-theme';
import { buttonStyle, cardStyle, inputStyle, labelStyle, mutedStyle } from './census-styles';

// Starting a run, and picking one to work on.
//
// The scope and method boxes are required by the route, not decorated as optional here, because a
// run without them produces counts nobody can reproduce — which is the failure this whole thing
// exists to avoid.

export function CensusRunForm({
  tokens,
  onCreate,
}: {
  tokens: CensusTokens;
  onCreate: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [observedOn, setObservedOn] = useState('');
  const [frameKind, setFrameKind] = useState<QuoraCensusFrameKind>('existing_list');
  const [topicScope, setTopicScope] = useState('');
  const [samplingMethod, setSamplingMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const created = await onCreate({ observedOn, frameKind, topicScope, samplingMethod, notes });
    setBusy(false);
    if (created) {
      setObservedOn('');
      setTopicScope('');
      setSamplingMethod('');
      setNotes('');
    }
  };

  return (
    <section style={cardStyle(tokens)}>
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', color: tokens.TITLE }}>
        Start a run
      </h3>
      <p style={mutedStyle(tokens)}>
        A run is one snapshot: everything coded under it describes Quora as it was on the date you
        give here.
      </p>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="run-date" style={labelStyle(tokens)}>Observation date</label>
        <input
          id="run-date"
          type="date"
          value={observedOn}
          onChange={(event) => setObservedOn(event.target.value)}
          style={inputStyle(tokens)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="run-frame" style={labelStyle(tokens)}>Where the accounts come from</label>
        <select
          id="run-frame"
          value={frameKind}
          onChange={(event) => setFrameKind(event.target.value as QuoraCensusFrameKind)}
          style={inputStyle(tokens)}
        >
          {QUORA_CENSUS_FRAME_KIND.map((kind) => (
            <option key={kind} value={kind}>{QUORA_CENSUS_FRAME_KIND_LABEL[kind]}</option>
          ))}
        </select>
        <p style={mutedStyle(tokens)}>{QUORA_CENSUS_FRAME_KIND_SUPPORTS[frameKind]}</p>
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="run-scope" style={labelStyle(tokens)}>What was searched</label>
        <textarea
          id="run-scope"
          rows={2}
          value={topicScope}
          onChange={(event) => setTopicScope(event.target.value)}
          placeholder="e.g. the gang stalking topic and the three questions linked from it"
          style={{ ...inputStyle(tokens), resize: 'vertical' }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="run-method" style={labelStyle(tokens)}>How accounts were picked</label>
        <textarea
          id="run-method"
          rows={2}
          value={samplingMethod}
          onChange={(event) => setSamplingMethod(event.target.value)}
          placeholder="e.g. every account answering the first 40 results, in order, no skipping"
          style={{ ...inputStyle(tokens), resize: 'vertical' }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="run-notes" style={labelStyle(tokens)}>Notes (optional)</label>
        <textarea
          id="run-notes"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          style={{ ...inputStyle(tokens), resize: 'vertical' }}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || observedOn.length === 0 || topicScope.trim().length === 0 || samplingMethod.trim().length === 0}
        style={{ ...buttonStyle(tokens, true), marginTop: 14 }}
      >
        <Plus size={15} aria-hidden="true" />
        {busy ? 'Starting…' : 'Start run'}
      </button>
    </section>
  );
}

export function CensusRunList({
  runs,
  tokens,
  onOpen,
}: {
  runs: CensusRunSummary[];
  tokens: CensusTokens;
  onOpen: (runId: string) => void;
}) {
  if (runs.length === 0) {
    return (
      <section style={cardStyle(tokens)}>
        <p style={{ fontSize: 14, color: tokens.TEXT, margin: 0 }}>
          No runs yet. The first one is the baseline everything later gets compared against.
        </p>
      </section>
    );
  }

  return (
    <section style={cardStyle(tokens)}>
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', color: tokens.TITLE }}>Runs</h3>
      {runs.map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => onOpen(run.id)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${tokens.BORDER_SOLID}`,
            border: 'none',
            borderTopStyle: 'solid',
            background: 'transparent',
            color: tokens.TEXT,
            fontSize: 13,
            lineHeight: 1.6,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'block', color: tokens.TITLE, fontWeight: 700 }}>
            {run.observed_on} · {run.status === 'closed' ? 'closed' : 'open'} ·{' '}
            {run.frame_kind === 'existing_list' ? 'from a list' : 'from a search'}
          </span>
          <span style={{ display: 'block' }}>
            {run.live_count} live of {run.entry_count} coded
          </span>
          <span style={{ display: 'block', color: tokens.MUTED }}>{run.topic_scope}</span>
        </button>
      ))}
    </section>
  );
}
