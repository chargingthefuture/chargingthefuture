"use client";

import { useEffect, useState } from "react";
import type { Currency } from "lib/currency/types";
import { SERVICE_CREDITS_LABEL } from "lib/currency/types";
import { sortPreferred } from "lib/currency/format";

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
  currencies: provided,
}: CurrencySelectProps) {
  const [currencies, setCurrencies] = useState<Currency[]>(provided ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (provided) {
      setCurrencies(provided);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/currencies", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load currencies");
        const data = (await res.json()) as { currencies?: Currency[] };
        if (active) setCurrencies(Array.isArray(data.currencies) ? data.currencies : []);
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load currencies");
      }
    })();
    return () => {
      active = false;
    };
  }, [provided]);

  const sorted = sortPreferred(currencies);

  return (
    <select
      id={id}
      className={className}
      disabled={disabled || sorted.length === 0}
      value={value}
      aria-label={ariaLabel ?? "Currency"}
      onChange={(event) => {
        const code = event.target.value;
        onChange(code, sorted.find((c) => c.code === code) ?? null);
      }}
    >
      {sorted.length === 0 ? (
        <option value="">{error ? "Currencies unavailable" : "Loading…"}</option>
      ) : (
        sorted.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {optionLabel(currency)}
          </option>
        ))
      )}
    </select>
  );
}
