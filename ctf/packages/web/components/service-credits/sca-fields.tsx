'use client';

// Small presentational building blocks shared by the ServiceCredits admin panels:
// a labelled text/number input and a confirm-before-commit step. Kept separate so each
// action panel stays small (rule 116) and the confirm gesture is identical everywhere.
import { useState, type ReactNode } from 'react';

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
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        value={value}
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
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
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setArmed(true)}
        className={
          tone === 'danger'
            ? 'inline-flex items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 disabled:opacity-50'
            : 'inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50'
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-sm text-amber-200">{summary}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Confirm'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setArmed(false)}
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null;
  if (error) {
    return (
      <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
    );
  }
  return (
    <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
      {notice}
    </p>
  );
}
