import { Pool } from 'pg';

// Owner-curated launch catalog for the `currencies` reference table (issue #120).
// Idempotent: ON CONFLICT keeps schema.sql's inline seed and this script in sync. The owner adds
// more currencies over time. ServiceCredits sorts first (code 'SC', label 'ServiceCredits') — the
// label is what UI renders; the bare code is internal only.
const CURRENCIES = [
  { code: 'SC',  label: 'ServiceCredits',         kind: 'token',  isSC: true,  symbol: null,  decimals: 0, sort: 0 },
  { code: 'USD', label: 'United States Dollar',   kind: 'fiat',   isSC: false, symbol: '$',   decimals: 2, sort: 10 },
  { code: 'EUR', label: 'Euro',                   kind: 'fiat',   isSC: false, symbol: '€',   decimals: 2, sort: 20 },
  { code: 'JPY', label: 'Japanese Yen',           kind: 'fiat',   isSC: false, symbol: '¥',   decimals: 0, sort: 30 },
  { code: 'GBP', label: 'British Pound Sterling', kind: 'fiat',   isSC: false, symbol: '£',   decimals: 2, sort: 40 },
  { code: 'CHF', label: 'Swiss Franc',            kind: 'fiat',   isSC: false, symbol: 'CHF', decimals: 2, sort: 50 },
  { code: 'CAD', label: 'Canadian Dollar',        kind: 'fiat',   isSC: false, symbol: 'CA$', decimals: 2, sort: 60 },
  { code: 'AUD', label: 'Australian Dollar',      kind: 'fiat',   isSC: false, symbol: 'A$',  decimals: 2, sort: 70 },
  { code: 'CNY', label: 'Chinese Yuan',           kind: 'fiat',   isSC: false, symbol: 'CN¥', decimals: 2, sort: 80 },
  { code: 'INR', label: 'Indian Rupee',           kind: 'fiat',   isSC: false, symbol: '₹',   decimals: 2, sort: 90 },
  { code: 'BRL', label: 'Brazilian Real',         kind: 'fiat',   isSC: false, symbol: 'R$',  decimals: 2, sort: 100 },
  { code: 'BTC', label: 'Bitcoin',                kind: 'crypto', isSC: false, symbol: '₿',   decimals: 8, sort: 110 },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function seed() {
  const pool = new Pool({
    connectionString: requireEnv('DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      for (const c of CURRENCIES) {
        await client.query(
          `INSERT INTO currencies
             (code, label, kind, is_service_credits, symbol, decimal_places, requires_amount, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
           ON CONFLICT (code) DO UPDATE SET
             label              = EXCLUDED.label,
             kind               = EXCLUDED.kind,
             is_service_credits = EXCLUDED.is_service_credits,
             symbol             = EXCLUDED.symbol,
             decimal_places     = EXCLUDED.decimal_places,
             sort_order         = EXCLUDED.sort_order,
             updated_at         = NOW()`,
          [c.code, c.label, c.kind, c.isSC, c.symbol, c.decimals, c.sort]
        );
      }

      await client.query('COMMIT');
      console.log(`Seeded ${CURRENCIES.length} currencies.`);
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
