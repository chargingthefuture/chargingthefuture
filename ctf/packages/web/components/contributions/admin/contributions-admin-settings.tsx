'use client';

import { useState } from 'react';
import { ToggleRight, ToggleLeft, Save } from 'lucide-react';
import type { ContributionsRuntimeConfig } from '@/lib/contributions/types';
import type { ContributionsTokens } from '../contributions-shared';
import { creditsPerActionFromConfig } from './contributions-admin-shared';

export type SettingsSaveInput = {
  creditsPerUsd: number;
  creditsPerAction: number;
  perUserCycleCreditCap: number;
  bannerEnabled: boolean;
  signalInstructions: string;
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
      style={{ width, padding: '7px 10px', background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 7, fontSize: 12, color: t.TEXT, outline: 'none' }}
    />
  );
}

/**
 * Settings: credit valuation knobs, per-cycle cap, banner on/off, and the Signal instructions
 * copy. "Credits per comment or star" is the resulting SC value; it is converted back to the
 * stored non_monetary_unit_value_usd (USD-equivalent) on save so the stored model stays
 * authoritative. A helper shows the resulting SC live.
 */
export function ContributionsAdminSettings({ t, config, saving, error, onSave }: SettingsProps) {
  const [creditsPerUsd, setCreditsPerUsd] = useState(String(config.creditsPerUsd));
  const [creditsPerAction, setCreditsPerAction] = useState(String(creditsPerActionFromConfig(config)));
  const [cap, setCap] = useState(String(config.perUserCycleCreditCap));
  const [bannerEnabled, setBannerEnabled] = useState(config.bannerEnabled);
  const [signalInstructions, setSignalInstructions] = useState(config.signalInstructions);

  function save() {
    onSave({
      creditsPerUsd: Number(creditsPerUsd) || config.creditsPerUsd,
      creditsPerAction: Number(creditsPerAction) || creditsPerActionFromConfig(config),
      perUserCycleCreditCap: Number(cap) || config.perUserCycleCreditCap,
      bannerEnabled,
      signalInstructions,
    });
  }

  const cardStyle: React.CSSProperties = {
    background: t.SURFACE,
    borderRadius: 12,
    padding: 16,
    border: `1px solid ${t.BORDER_SOLID}`,
    maxWidth: 520,
    marginBottom: 18,
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 16 }}>ServiceCredits</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <label htmlFor="contrib-credits-per-usd" style={{ fontSize: 12, color: t.MUTED, flex: 1 }}>Credits per dollar (gift card)</label>
          {numInput(t, 'contrib-credits-per-usd', creditsPerUsd, setCreditsPerUsd)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <label htmlFor="contrib-credits-per-action" style={{ fontSize: 12, color: t.MUTED, flex: 1 }}>Credits per comment or star</label>
          {numInput(t, 'contrib-credits-per-action', creditsPerAction, setCreditsPerAction)}
        </div>
        <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 12 }}>
          Stored as a USD-equivalent unit value ({(Number(creditsPerAction) / (Number(creditsPerUsd) || 1) || 0).toFixed(2)} USD) × credits per dollar.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label htmlFor="contrib-per-drive-cap" style={{ fontSize: 12, color: t.MUTED, flex: 1 }}>Per-member per-drive cap (SC)</label>
          {numInput(t, 'contrib-per-drive-cap', cap, setCap)}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>Fundraiser banner</div>
            <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>Show the slim banner to signed-in members</div>
          </div>
          <button
            type="button"
            aria-label="Toggle fundraiser banner"
            aria-pressed={bannerEnabled}
            onClick={() => setBannerEnabled((b) => !b)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: bannerEnabled ? t.ACCENT : t.MUTED, display: 'flex' }}
          >
            {bannerEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 8 }}>Signal instructions</div>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 10 }}>Shown to members on the post-submit confirmation screen.</div>
        <textarea
          value={signalInstructions}
          onChange={(e) => setSignalInstructions(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '9px 12px', background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 8, fontSize: 12, color: t.TEXT, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
        />
        {error && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 10 }}>{error}</div>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          <Save size={12} /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
