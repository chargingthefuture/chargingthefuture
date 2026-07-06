"use client";

import type { CSSProperties } from "react";
import { COUNTRIES, US_STATES, usesStateList } from "lib/geo/locations";

// Shared location controls so Country/State data stays clean instead of free-text. Each control renders
// only the field itself (no label/wrapper) so a form supplies its own label and layout — the same way
// the LightHouse host form wraps the shared CurrencySelect. Stored values are the plain names (e.g.
// "United States", "California"), so a legacy free-text value still displays: it is added as an extra
// option when it is not already in the canonical list.

export interface CountrySelectProps {
  value: string;
  onChange: (country: string) => void;
  style?: CSSProperties;
  id?: string;
  ariaLabel?: string;
}

export function CountrySelect({ value, onChange, style, id, ariaLabel }: CountrySelectProps) {
  const known = COUNTRIES.includes(value);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
      aria-label={ariaLabel ?? "Country"}
    >
      <option value="">Select country…</option>
      {value && !known ? <option value={value}>{value}</option> : null}
      {COUNTRIES.map((country) => (
        <option key={country} value={country}>{country}</option>
      ))}
    </select>
  );
}

export interface StateFieldProps {
  /** The selected country — decides whether State is a dropdown (US) or a free-text region box. */
  country: string;
  value: string;
  onChange: (state: string) => void;
  style?: CSSProperties;
  id?: string;
  ariaLabel?: string;
}

export function StateField({ country, value, onChange, style, id, ariaLabel }: StateFieldProps) {
  if (!usesStateList(country)) {
    return (
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={style}
        aria-label={ariaLabel ?? "State or region"}
      />
    );
  }

  const known = US_STATES.includes(value);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
      aria-label={ariaLabel ?? "State"}
    >
      <option value="">Select state…</option>
      {value && !known ? <option value={value}>{value}</option> : null}
      {US_STATES.map((state) => (
        <option key={state} value={state}>{state}</option>
      ))}
    </select>
  );
}
