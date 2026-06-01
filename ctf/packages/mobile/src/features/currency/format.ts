// Mobile mirror of ctf/packages/web/lib/currency/format.ts (issue #120) — keep the two in sync.
import type { Currency } from './types';
import { SERVICE_CREDITS_LABEL } from './types';

/**
 * Sort currencies so ServiceCredits is always first (the platform's preferred currency wherever
 * multiple options appear), then by sort_order, then code.
 */
export function sortPreferred(currencies: Currency[]): Currency[] {
  return [...currencies].sort((a, b) => {
    if (a.isServiceCredits !== b.isServiceCredits) return a.isServiceCredits ? -1 : 1;
    return a.sortOrder - b.sortOrder || a.code.localeCompare(b.code);
  });
}

function labelOf(currency: Currency): string {
  return currency.isServiceCredits ? SERVICE_CREDITS_LABEL : currency.label;
}

/**
 * Format a single listed price in its own currency. ServiceCredits renders as "N ServiceCredits"
 * (never a fiat symbol). Barter / amount-less currencies render their label only.
 */
export function formatPrice(amount: number | null, currency: Currency): string {
  if (currency.kind === 'barter' || !currency.requiresAmount || amount === null) {
    return labelOf(currency);
  }
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  });
  if (currency.isServiceCredits) {
    return `${formatted} ${SERVICE_CREDITS_LABEL}`;
  }
  return currency.symbol ? `${currency.symbol}${formatted}` : `${formatted} ${currency.code}`;
}

/**
 * Compact-view label for an accepted-currencies set: ServiceCredits first, then a capped remainder
 * (e.g. "Accepts ServiceCredits +2"). Full set belongs in the detail view.
 */
export function formatAcceptedCurrencies(currencies: Currency[], maxVisible = 1): string {
  if (currencies.length === 0) return '';
  const sorted = sortPreferred(currencies);
  const visible = sorted.slice(0, Math.max(1, maxVisible));
  const remainder = sorted.length - visible.length;
  const head = `Accepts ${visible.map(labelOf).join(', ')}`;
  return remainder > 0 ? `${head} +${remainder}` : head;
}
