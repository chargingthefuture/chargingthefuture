'use client';

import { useState } from 'react';
import type { ContributorAccessTokens } from './contributor-access-shared';
import {
  CONTRIBUTOR_VALUE_EVENT_KEYS,
  DEFAULT_WEIGHTS,
  EVENT_LABEL,
} from 'lib/contributor-access/weights';

// Owner-tunable config editor: threshold, gate minimums, per-event weights from the fixed key
// list, and the channel_open toggle (disabled — the gated channel ships in a later slice).

export type ContributorAccessConfigView = {
  weights: Record<string, number>;
  threshold: number;
  minAccountAgeDays: number;
  minDistinctPlugins: number;
  minCounterparties: number;
  minEligibleToOpenChannel: number;
  channelOpen: boolean;
};

type FormState = {
  threshold: string;
  minAccountAgeDays: string;
  minDistinctPlugins: string;
  minCounterparties: string;
  minEligibleToOpenChannel: string;
  weights: Record<string, string>;
};

function toFormState(config: ContributorAccessConfigView): FormState {
  const weights: Record<string, string> = {};
  for (const key of CONTRIBUTOR_VALUE_EVENT_KEYS) {
    weights[key] = String(config.weights[key] ?? DEFAULT_WEIGHTS[key]);
  }
  return {
    threshold: String(config.threshold),
    minAccountAgeDays: String(config.minAccountAgeDays),
    minDistinctPlugins: String(config.minDistinctPlugins),
    minCounterparties: String(config.minCounterparties),
    minEligibleToOpenChannel: String(config.minEligibleToOpenChannel),
    weights,
  };
}

function parseNonNegative(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function NumberField({
  t,
  label,
  value,
  onChange,
}: {
  t: ContributorAccessTokens;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: t.MUTED, minWidth: 150, flex: 1 }}>
      {label}
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ padding: '7px 10px', borderRadius: 8, background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13 }}
      />
    </label>
  );
}

export function ConfigEditorSection({
  t,
  config,
  saving,
  onSave,
}: {
  t: ContributorAccessTokens;
  config: ContributorAccessConfigView;
  saving: boolean;
  onSave: (update: ContributorAccessConfigView) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(config));
  const [formError, setFormError] = useState<string | null>(null);

  const setField = (field: keyof Omit<FormState, 'weights'>, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const setWeight = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, weights: { ...prev.weights, [key]: value } }));

  const submit = () => {
    const threshold = parseNonNegative(form.threshold);
    const minAccountAgeDays = parseNonNegative(form.minAccountAgeDays);
    const minDistinctPlugins = parseNonNegative(form.minDistinctPlugins);
    const minCounterparties = parseNonNegative(form.minCounterparties);
    const minEligibleToOpenChannel = parseNonNegative(form.minEligibleToOpenChannel);
    const weights: Record<string, number> = {};
    for (const key of CONTRIBUTOR_VALUE_EVENT_KEYS) {
      const value = parseNonNegative(form.weights[key] ?? '');
      if (value === null) {
        setFormError(`"${EVENT_LABEL[key]}" needs a non-negative number.`);
        return;
      }
      weights[key] = value;
    }
    if (
      threshold === null ||
      minAccountAgeDays === null ||
      minDistinctPlugins === null ||
      minCounterparties === null ||
      minEligibleToOpenChannel === null
    ) {
      setFormError('Threshold and minimums need non-negative numbers.');
      return;
    }
    setFormError(null);
    onSave({
      weights,
      threshold,
      minAccountAgeDays,
      minDistinctPlugins,
      minCounterparties,
      minEligibleToOpenChannel,
      channelOpen: config.channelOpen,
    });
  };

  return (
    <section style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: t.TITLE, margin: '0 0 10px' }}>Eligibility settings</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <NumberField t={t} label="Score threshold" value={form.threshold} onChange={(v) => setField('threshold', v)} />
        <NumberField t={t} label="Minimum account age (days)" value={form.minAccountAgeDays} onChange={(v) => setField('minAccountAgeDays', v)} />
        <NumberField t={t} label="Minimum distinct plugins" value={form.minDistinctPlugins} onChange={(v) => setField('minDistinctPlugins', v)} />
        <NumberField t={t} label="Minimum distinct counterparties" value={form.minCounterparties} onChange={(v) => setField('minCounterparties', v)} />
        <NumberField t={t} label="Eligible members needed to open the channel" value={form.minEligibleToOpenChannel} onChange={(v) => setField('minEligibleToOpenChannel', v)} />
      </div>

      <h3 style={{ fontSize: 12, fontWeight: 700, color: t.TITLE, margin: '0 0 8px' }}>Per-event weights</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {CONTRIBUTOR_VALUE_EVENT_KEYS.map((key) => (
          <NumberField key={key} t={t} label={EVENT_LABEL[key]} value={form.weights[key] ?? ''} onChange={(v) => setWeight(key, v)} />
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.MUTED, marginBottom: 12 }}>
        <input type="checkbox" checked={config.channelOpen} disabled readOnly />
        Channel open — channel ships in a later slice
      </label>

      {formError ? (
        <div role="status" style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 12 }}>
          {formError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        style={{ padding: '8px 14px', borderRadius: 8, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </section>
  );
}
