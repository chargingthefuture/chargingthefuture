import type { QueryResultRow } from 'pg';
import { queryDb } from 'lib/db/postgres';
import type { Currency } from './types';

interface CurrencyRow extends QueryResultRow {
  code: string;
  label: string;
  kind: string;
  is_service_credits: boolean;
  symbol: string | null;
  decimal_places: number;
  requires_amount: boolean;
  is_active: boolean;
  sort_order: number;
}

function mapCurrency(row: CurrencyRow): Currency {
  return {
    code: row.code,
    label: row.label,
    kind: row.kind as Currency['kind'],
    isServiceCredits: row.is_service_credits,
    symbol: row.symbol,
    decimalPlaces: Number(row.decimal_places),
    requiresAmount: row.requires_amount,
    isActive: row.is_active,
    sortOrder: Number(row.sort_order),
  };
}

const SELECT_COLUMNS =
  'code, label, kind, is_service_credits, symbol, decimal_places, requires_amount, is_active, sort_order';

/** Active currencies, ServiceCredits first (sort_order 0), for dropdowns and display. */
export async function listActiveCurrencies(): Promise<Currency[]> {
  const result = await queryDb<CurrencyRow>(
    `SELECT ${SELECT_COLUMNS} FROM currencies WHERE is_active = TRUE ORDER BY sort_order ASC, code ASC`,
  );
  return result.rows.map(mapCurrency);
}

/** Resolve a single currency by its code (including inactive), or null if unknown. */
export async function getCurrency(code: string): Promise<Currency | null> {
  const result = await queryDb<CurrencyRow>(
    `SELECT ${SELECT_COLUMNS} FROM currencies WHERE code = $1`,
    [code],
  );
  const row = result.rows[0];
  return row ? mapCurrency(row) : null;
}

/** True if the given currency code is an active, known currency. */
export async function isValidCurrencyCode(code: string): Promise<boolean> {
  const result = await queryDb<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM currencies WHERE code = $1 AND is_active = TRUE) AS exists`,
    [code],
  );
  return Boolean(result.rows[0]?.exists);
}
