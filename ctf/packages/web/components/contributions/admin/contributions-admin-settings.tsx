'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import type { ContributionsRuntimeConfig } from '@/lib/contributions/types';
import type { ContributionsTokens } from '../contributions-shared';

export type SettingsSaveInput = {
  creditsPerUsd: number;
  perUserYearCreditCap: number;
};

export type SettingsProps = {
  t: ContributionsTokens;
  config: ContributionsRuntimeConfig;
  saving: boolean;
  error: string | null;
  onSave: (input: SettingsSaveInput) => void;
  isMobile: boolean;
};

function numInput(t: ContributionsTokens, id: string, value: string, onChange: (v: string) => void, width = 90) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="numeric"
      style={{ width, minHeight: 36, padding: '7px 10px', background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 7, fontSize: 12, color: t.TEXT, outline: 'none' }}
    />
  );
}

// Settings: thank-you credits per dollar, and the most one member is granted over the last 365 days.
export function ContributionsAdminSettings({ t, config, saving, error, onSave }: SettingsProps) {
  const [creditsPerUsd, setCreditsPerUsd] = useState(String(config.creditsPerUsd));
  const [cap, setCap] = useState(String(config.perUserYearCreditCap));

  function save() {
    onSave({
      creditsPerUsd: Number(creditsPerUsd) || config.creditsPerUsd,
      perUserYearCreditCap: Number(cap) || config.perUserYearCreditCap,
    });
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
      <div style={{ background: t.SURFACE, borderRadius: 12, padding: 16, border: `1px solid ${t.BORDER_SOLID}`, maxWidth: 520 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 16 }}>ServiceCredits</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <label htmlFor="contrib-credits-per-usd" style={{ fontSize: 12, color: t.MUTED, flex: 1 }}>Credits per dollar</label>
          {numInput(t, 'contrib-credits-per-usd', creditsPerUsd, setCreditsPerUsd)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label htmlFor="contrib-year-cap" style={{ fontSize: 12, color: t.MUTED, flex: 1 }}>Most credits per member over 365 days</label>
          {numInput(t, 'contrib-year-cap', cap, setCap)}
        </div>
        {error && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 10 }}>{error}</div>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '8px 16px', borderRadius: 7, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          <Save size={12} /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
