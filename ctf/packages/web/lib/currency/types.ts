// Currency model shared across value-bearing plugins (issue #120).
// ServiceCredits is the platform credits unit. Its technical code is 'SC', but UI must always
// render the label 'ServiceCredits' and must never show a ServiceCredits amount at a fiat equivalent.

export type CurrencyKind = 'token' | 'fiat' | 'crypto' | 'barter' | 'free';

export interface Currency {
  code: string;
  label: string;
  kind: CurrencyKind;
  isServiceCredits: boolean;
  symbol: string | null;
  decimalPlaces: number;
  requiresAmount: boolean;
  isActive: boolean;
  sortOrder: number;
}

/** Technical code of the platform credits unit. Internal only — never render it in UI. */
export const SERVICE_CREDITS_CODE = 'SC';
/** The only user-facing name for the token. */
export const SERVICE_CREDITS_LABEL = 'ServiceCredits';

/** A listed price: an amount in a single currency (amount is null for barter / amount-less rows). */
export interface PricedValue {
  amount: number | null;
  currencyCode: string;
}
