// LightHouse rent/currency display helpers — mobile mirror of the web helpers in
// ctf/packages/web/components/lighthouse/shared.ts (formatRentParts, acceptedCurrencyLabels).
// Keep the two in step: a ServiceCredits rent renders as "N ServiceCredits" (never a "$"), and the
// number stays large while a long currency label renders small next to it.
import type { Currency } from '../currency/types';
import { SERVICE_CREDITS_LABEL } from '../currency/types';
import { sortPreferred } from '../currency/format';
import type { LighthouseProperty } from './types';

/** Lookup from currency code to Currency, built once from GET /api/currencies. */
export type CurrencyMap = Record<string, Currency>;

export function buildCurrencyMap(currencies: Currency[]): CurrencyMap {
  const map: CurrencyMap = {};
  for (const currency of currencies) map[currency.code] = currency;
  return map;
}

/**
 * A rent split into a large primary part and a small unit label, so a long currency name like
 * "ServiceCredits" renders small next to the number instead of at the giant price font size.
 * `perMonth` is false for "Free" and amount-less currencies (no "/mo").
 */
export interface RentParts {
  primary: string;
  unit: string | null;
  perMonth: boolean;
}

export function formatRentParts(property: LighthouseProperty, currencies: CurrencyMap): RentParts | null {
  const amount = property.monthlyRent;
  if (amount === null || !Number.isFinite(amount)) return null;
  if (amount === 0) return { primary: 'Free', unit: null, perMonth: false };
  const code = property.rentCurrency ?? 'USD';
  const currency = currencies[code];
  if (!currency) return { primary: `$${amount}`, unit: null, perMonth: true };
  if (currency.kind === 'barter' || !currency.requiresAmount) {
    return { primary: currency.isServiceCredits ? SERVICE_CREDITS_LABEL : currency.label, unit: null, perMonth: false };
  }
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  });
  if (currency.isServiceCredits) return { primary: formatted, unit: SERVICE_CREDITS_LABEL, perMonth: true };
  if (currency.symbol) return { primary: `${currency.symbol}${formatted}`, unit: null, perMonth: true };
  return { primary: formatted, unit: currency.code, perMonth: true };
}

/** Accepted-currency labels for a listing, ServiceCredits first, resolved via the currency catalog. */
export function acceptedCurrencyLabels(property: LighthouseProperty, currencies: CurrencyMap): string[] {
  const resolved = (property.acceptedCurrencies ?? [])
    .map((code) => currencies[code])
    .filter((currency): currency is Currency => Boolean(currency));
  return sortPreferred(resolved).map((currency) => (currency.isServiceCredits ? SERVICE_CREDITS_LABEL : currency.label));
}
