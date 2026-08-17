"use client";

import { useCallback, useEffect, useState } from "react";
import type { Currency } from "lib/currency/types";
import { SERVICE_CREDITS_LABEL } from "lib/currency/types";
import { sortPreferred } from "lib/currency/format";
import { reportError } from "lib/observability/report";

// Shared accepted-currencies checklist. Mirrors the LightHouse host form's checkbox pattern so every
// pricing form offers the same control: the listed price above names ONE settlement, and these
// checkboxes independently name EVERY currency the poster accepts. A post settled part in
// ServiceCredits and part in dollars checks both instead of forcing a zero into one of them, and the
// projected/actual value of the transaction can be recorded whole. Reads the same live catalog as
// CurrencySelect (`GET /api/currencies`).

function optionLabel(currency: Currency): string {
  if (currency.isServiceCredits) return SERVICE_CREDITS_LABEL;
  return currency.symbol ? `${currency.label} (${currency.symbol})` : currency.label;
}

/**
 * Compact badge label for an accepted set: first code (server order puts ServiceCredits first) plus
 * a capped "+N" remainder, e.g. "Accepts ServiceCredits +2". Codes render by their known labels
 * ('SC' never leaks; 'FREE'/'BARTER' read plainly); other codes are shown as-is (e.g. "USD"),
 * matching the existing settlement badges. Returns null when the post names no accepted set.
 */
export function acceptedCurrenciesBadgeLabel(codes: string[] | null | undefined): string | null {
  if (!codes || codes.length === 0) return null;
  const labelFor = (code: string) =>
    code === "SC" ? SERVICE_CREDITS_LABEL : code === "FREE" ? "Free" : code === "BARTER" ? "Barter" : code;
  const head = `Accepts ${labelFor(codes[0])}`;
  return codes.length > 1 ? `${head} +${codes.length - 1}` : head;
}

export interface AcceptedCurrencyPickerColors {
  text: string;
  muted: string;
  border: string;
  accent: string;
}

export interface AcceptedCurrencyPickerProps {
  /** Currency codes currently checked. */
  accepted: string[];
  onToggle: (code: string) => void;
  /** Plugin-voice helper line under the heading, e.g. what checking a currency means for this post. */
  hint: string;
  colors: AcceptedCurrencyPickerColors;
  /** Heading text; defaults to the standard "Accepted currencies". */
  label?: string;
  /** Optional pre-fetched catalog; if omitted the picker fetches it itself. */
  currencies?: Currency[];
}

export function AcceptedCurrencyPicker({
  accepted,
  onToggle,
  hint,
  colors,
  label = "Accepted currencies",
  currencies: provided,
}: AcceptedCurrencyPickerProps) {
  const [currencies, setCurrencies] = useState<Currency[]>(provided ?? []);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (provided) {
      setCurrencies(provided);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/currencies", { cache: "no-store" });
        // Carry the status into the message and the report so a 403 / 500 / offline phone can be told
        // apart in production, same as CurrencySelect.
        if (!res.ok) throw new Error(`Currency catalog request failed (HTTP ${res.status})`);
        const data = (await res.json()) as { currencies?: Currency[] };
        if (active) setCurrencies(Array.isArray(data.currencies) ? data.currencies : []);
      } catch (e: unknown) {
        reportError(e, { area: "currency", op: "accepted_picker_catalog_load" });
        if (active) setError(e instanceof Error ? e.message : "Failed to load currencies");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [provided, reloadKey]);

  const retry = useCallback(() => setReloadKey((n) => n + 1), []);
  const sorted = sortPreferred(currencies);
  const failed = error !== null && sorted.length === 0;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>{hint}</div>
      {failed ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={retry}
            disabled={loading}
            style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${colors.border}`, color: colors.text, fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Retrying…" : "Retry"}
          </button>
          <span role="status" style={{ fontSize: 12, color: colors.muted }}>
            The currency options could not be loaded, so this post keeps its current accepted set.
            Retry to change it.
          </span>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: colors.muted }}>Loading currencies…</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {sorted.map((currency) => {
            const checked = accepted.includes(currency.code);
            const text = optionLabel(currency);
            return (
              <label
                key={currency.code}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: colors.text, cursor: "pointer", background: checked ? `${colors.accent}14` : "transparent", border: `1px solid ${checked ? colors.accent + "40" : colors.border}`, borderRadius: 8, padding: "6px 10px" }}
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(currency.code)} aria-label={`Accept ${text}`} />
                {text}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
