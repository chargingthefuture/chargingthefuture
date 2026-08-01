"use client";

import { useCallback, useEffect, useState } from "react";
import type { Currency } from "lib/currency/types";
import { SERVICE_CREDITS_LABEL } from "lib/currency/types";
import { sortPreferred } from "lib/currency/format";
import { reportError } from "lib/observability/report";

// Shared payment-currency selector (issue #420). One control reused by every value-bearing plugin so
// the options and ordering stay identical: ServiceCredits first, then fiat, crypto, and barter — read
// live from the currencies catalog (`GET /api/currencies`). ServiceCredits always renders by its label,
// never the bare "SC" code, and a ServiceCredits amount is never shown at a fiat equivalent. Barter
// (kind=barter, requiresAmount=false) appears here too; callers can use the returned Currency to decide
// whether to show an amount input.

function optionLabel(currency: Currency): string {
  if (currency.isServiceCredits) return SERVICE_CREDITS_LABEL;
  return currency.symbol ? `${currency.label} (${currency.symbol})` : currency.label;
}

export interface CurrencySelectProps {
  value: string;
  onChange: (code: string, currency: Currency | null) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Links helper/error text to the control via aria-describedby (e.g. from the shared FormField). */
  describedBy?: string;
  /** Optional pre-fetched list; if omitted the component fetches the catalog itself. */
  currencies?: Currency[];
}

export function CurrencySelect({
  value,
  onChange,
  id,
  disabled,
  className,
  ariaLabel,
  describedBy,
  currencies: provided,
}: CurrencySelectProps) {
  const [currencies, setCurrencies] = useState<Currency[]>(provided ?? []);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry to re-run the load. Without it a member whose catalog request failed once was
  // stuck with a disabled control for the life of the page — the failure was terminal with no way
  // back, which is how a paid post got published carrying the default settlement instead of the one
  // its author meant to choose (owner report).
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
        // Carry the status into the message and the report. "Failed to load currencies" alone cannot
        // be told apart from a 403, a 500, or an offline phone, which left this undiagnosable in
        // production.
        if (!res.ok) throw new Error(`Currency catalog request failed (HTTP ${res.status})`);
        const data = (await res.json()) as { currencies?: Currency[] };
        if (active) setCurrencies(Array.isArray(data.currencies) ? data.currencies : []);
      } catch (e: unknown) {
        // Reported, not just shown: a silent client-side failure here disables the settlement control
        // in every value-bearing plugin at once, and nothing surfaced it.
        reportError(e, { area: "currency", op: "select_catalog_load" });
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

  const select = (
    <select
      id={id}
      className={className}
      disabled={disabled || sorted.length === 0}
      value={value}
      aria-label={ariaLabel ?? "Currency"}
      aria-describedby={describedBy}
      onChange={(event) => {
        const code = event.target.value;
        onChange(code, sorted.find((c) => c.code === code) ?? null);
      }}
    >
      {sorted.length === 0 ? (
        <option value="">{failed ? "Couldn't load options" : "Loading…"}</option>
      ) : (
        sorted.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {optionLabel(currency)}
          </option>
        ))
      )}
    </select>
  );

  // On success the control renders exactly as before — a bare <select>, so no caller's layout moves.
  if (!failed) return select;

  // On failure it gains a Retry and says what will happen if the member saves anyway. Saying so
  // matters: the form keeps its default settlement, so a member who cannot reach the catalog would
  // otherwise publish a settlement they never chose without being told.
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {select}
      <button
        type="button"
        onClick={retry}
        disabled={loading}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          background: "transparent",
          border: "1px solid var(--ctf-border, rgba(255,255,255,0.18))",
          color: "var(--ctf-text, #E8EAF0)",
          fontSize: 12,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Retrying…" : "Retry"}
      </button>
      <span role="status" style={{ fontSize: 12, color: "var(--ctf-text-secondary, #9CA3AF)", flexBasis: "100%" }}>
        The settlement options could not be loaded, so this post keeps its current setting. Retry to
        choose a different one.
      </span>
    </span>
  );
}
