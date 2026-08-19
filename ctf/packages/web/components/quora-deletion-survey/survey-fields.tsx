'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { SurveyTokens } from './survey-theme';

// Small labeled form primitives shared by the survey form and its per-account card.
//
// Every control is bound to a real <label htmlFor>, and every group of choices is a fieldset with
// a legend. That is what the accessibility gate checks statically, and it is also what makes the
// form usable by someone filling it in on a phone with a screen reader — which, for this
// audience, is not a hypothetical.

export function fieldLabelStyle(t: SurveyTokens): CSSProperties {
  return { display: 'block', fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 6 };
}

export function inputStyle(t: SurveyTokens): CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 10,
    background: t.INPUT_BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    color: t.TEXT,
    fontSize: 15,
    fontFamily: 'inherit',
  };
}

export function hintStyle(t: SurveyTokens): CSSProperties {
  return { fontSize: 12, lineHeight: 1.55, color: t.MUTED, margin: '6px 0 0' };
}

export function Field({
  id,
  label,
  hint,
  tokens,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  tokens: SurveyTokens;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <label htmlFor={id} style={fieldLabelStyle(tokens)}>
        {label}
      </label>
      {children}
      {hint ? <p style={hintStyle(tokens)}>{hint}</p> : null}
    </div>
  );
}

export function ChoiceGroup({
  legend,
  hint,
  tokens,
  children,
}: {
  legend: string;
  hint?: string;
  tokens: SurveyTokens;
  children: ReactNode;
}) {
  return (
    <fieldset
      style={{
        marginTop: 16,
        border: 'none',
        borderRadius: 0,
        padding: 0,
        minInlineSize: 0,
      }}
    >
      <legend style={{ ...fieldLabelStyle(tokens), padding: 0 }}>{legend}</legend>
      {children}
      {hint ? <p style={hintStyle(tokens)}>{hint}</p> : null}
    </fieldset>
  );
}

// A yes/no pair. Radio buttons rather than a checkbox, because a checkbox has no way to say "no"
// as distinct from "not answered", and several of these questions turn on exactly that
// difference.
export function YesNo({
  name,
  value,
  onChange,
  tokens,
  yesLabel = 'Yes',
  noLabel = 'No',
}: {
  name: string;
  value: boolean | null;
  onChange: (next: boolean) => void;
  tokens: SurveyTokens;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {[
        { key: 'yes', label: yesLabel, next: true },
        { key: 'no', label: noLabel, next: false },
      ].map((option) => (
        <label
          key={option.key}
          htmlFor={`${name}-${option.key}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 14px',
            borderRadius: 10,
            border: `1px solid ${value === option.next ? tokens.ACCENT : tokens.BORDER_SOLID}`,
            background: value === option.next ? `${tokens.ACCENT}22` : tokens.INPUT_BG,
            color: tokens.TEXT,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <input
            id={`${name}-${option.key}`}
            type="radio"
            name={name}
            checked={value === option.next}
            onChange={() => onChange(option.next)}
            style={{ accentColor: tokens.ACCENT }}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function CheckboxRow({
  id,
  label,
  checked,
  onChange,
  tokens,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  tokens: SurveyTokens;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '9px 0',
        color: tokens.TEXT,
        fontSize: 14,
        lineHeight: 1.5,
        cursor: 'pointer',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ accentColor: tokens.ACCENT, marginTop: 3 }}
      />
      <span>{label}</span>
    </label>
  );
}
