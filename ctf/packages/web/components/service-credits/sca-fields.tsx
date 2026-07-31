'use client';

// Small presentational building blocks shared by the ServiceCredits admin panels:
// a labelled text/number input and a confirm-before-commit step. Kept separate so each
// action panel stays small (rule 116) and the confirm gesture is identical everywhere.
// Dark admin design system (rule 131): ServiceCredits accent is #A855F7.
import { useState, type ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getServiceCreditsTokens, type ServiceCreditsTokens } from './sc-shared';

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  hint?: string;
}) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  return (
    <label style={{ display: 'block', fontSize: 13 }}>
      <span style={{ display: 'block', fontWeight: 600, color: t.MUTED, fontSize: 12, marginBottom: 4 }}>{label}</span>
      <input
        style={{
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: 8,
          border: `1px solid ${t.BORDER_SOLID}`,
          background: t.BG,
          color: t.TITLE,
          padding: '9px 12px',
          fontSize: 13,
          outline: 'none',
        }}
        value={value}
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span style={{ display: 'block', fontSize: 11, color: t.MUTED, marginTop: 4 }}>{hint}</span> : null}
    </label>
  );
}

// The un-armed primary button. Pressing it arms the confirm prompt. A "danger" tone renders
// the red destructive styling (used for burns); the default tone uses the ServiceCredits accent.
function ArmButton({
  label,
  busy,
  disabled,
  tone,
  onArm,
  t,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  tone: 'default' | 'danger';
  onArm: () => void;
  t: ServiceCreditsTokens;
}) {
  const blocked = disabled || busy;
  const isDanger = tone === 'danger';
  return (
    <button
      type="button"
      disabled={blocked}
      onClick={onArm}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        padding: '9px 16px',
        fontSize: 13,
        fontWeight: 700,
        cursor: blocked ? 'not-allowed' : 'pointer',
        opacity: blocked ? 0.5 : 1,
        background: isDanger ? 'rgba(239,68,68,0.1)' : t.ACCENT,
        border: isDanger ? '1px solid rgba(239,68,68,0.4)' : `1px solid ${t.ACCENT}`,
        color: isDanger ? '#FCA5A5' : '#FFFFFF',
      }}
    >
      {label}
    </button>
  );
}

// The armed state: a plain-language summary of exactly what will change plus Confirm / Cancel.
function ConfirmPrompt({
  summary,
  busy,
  onConfirm,
  onCancel,
  t,
}: {
  summary: ReactNode;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  t: ServiceCreditsTokens;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderRadius: 10,
        border: '1px solid rgba(245,158,11,0.4)',
        background: 'rgba(245,158,11,0.1)',
        padding: 14,
      }}
    >
      <p style={{ fontSize: 13, color: '#FCD34D', margin: 0, lineHeight: 1.5 }}>{summary}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
            background: t.ACCENT,
            border: `1px solid ${t.ACCENT}`,
            color: '#FFFFFF',
          }}
        >
          {busy ? 'Working…' : 'Confirm'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
            background: t.SURFACE,
            border: `1px solid ${t.BORDER_SOLID}`,
            color: t.MUTED,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// A two-step commit: the primary button arms a plain-language summary of exactly what
// will change; the operator must press "Confirm" to fire the mutation. Used for every
// state-changing action in the ServiceCredits admin (money core — no silent commits).
export function ConfirmAction({
  label,
  summary,
  busy,
  disabled,
  onConfirm,
  tone = 'default',
}: {
  label: string;
  summary: ReactNode;
  busy: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  tone?: 'default' | 'danger';
}) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <ArmButton label={label} busy={busy} disabled={disabled} tone={tone} onArm={() => setArmed(true)} t={t} />
    );
  }

  return (
    <ConfirmPrompt summary={summary} busy={busy} onConfirm={onConfirm} onCancel={() => setArmed(false)} t={t} />
  );
}

export function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null;
  if (error) {
    return (
      <p
        role="alert"
        style={{
          borderRadius: 10,
          border: '1px solid rgba(239,68,68,0.3)',
          background: 'rgba(239,68,68,0.1)',
          padding: '10px 14px',
          fontSize: 13,
          color: '#FCA5A5',
          margin: 0,
        }}
      >
        {error}
      </p>
    );
  }
  return (
    <p
      style={{
        borderRadius: 10,
        border: '1px solid rgba(34,197,94,0.3)',
        background: 'rgba(34,197,94,0.1)',
        padding: '10px 14px',
        fontSize: 13,
        color: '#86EFAC',
        margin: 0,
      }}
    >
      {notice}
    </p>
  );
}
