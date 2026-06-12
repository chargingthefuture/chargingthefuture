import { Pool } from 'pg';

// Seed the `currency_usd_rates` table (issue #121). Despite its historical name, this table now holds
// the Community Value Index CONTRIBUTION WEIGHTS: how much one unit of each value type adds to the
// single relative index. USD is just the reference base (weight 1). They are owner-curated, non-binding
// weights — not market quotes — and are revised over time (a new row per currency_code with a later
// `as_of` becomes the active weight).
//
// IMPORTANT: these weights are used ONLY to compute the aggregate Community Value Index, which is a
// relative measure, NOT money. They are NEVER shown as a price, an exchange rate, or a per-wallet/
// per-token fiat equivalence. The ServiceCredits and Barter weights in particular are non-binding index
// inputs, not redemption values — ServiceCredits is never convertible to fiat.
const AS_OF = '2026-01-01';
const SOURCE = 'owner-seed';

// 1 unit of <code> contributes <usdRate> to the Community Value Index (USD = 1 reference base).
// Owner-revisable, non-binding weights — not prices or redemption rates.
const RATES = [
  { code: 'USD', usdRate: 1 },
  { code: 'EUR', usdRate: 1.08 },
  { code: 'JPY', usdRate: 0.0067 },
  { code: 'GBP', usdRate: 1.27 },
  { code: 'CHF', usdRate: 1.12 },
  { code: 'CAD', usdRate: 0.73 },
  { code: 'AUD', usdRate: 0.66 },
  { code: 'CNY', usdRate: 0.14 },
  { code: 'INR', usdRate: 0.012 },
  { code: 'BRL', usdRate: 0.18 },
  { code: 'BTC', usdRate: 65000 },
  // ServiceCredits: a non-binding index weight, NOT a redemption rate — ServiceCredits is never
  // convertible to fiat. It contributes to the relative Community Value Index only.
  { code: 'SC', usdRate: 0.1 },
  // Barter: a no-money exchange. Counted by the NUMBER of completed barter trades; this weight is the
  // notional index contribution per trade (non-binding, owner-revisable). requires_amount is FALSE on
  // the currencies catalog row, so barter never carries a monetary amount.
  { code: 'BARTER', usdRate: 5 },
  // Free: one-way mutual aid at no charge. Like barter, counted by the NUMBER of completed free
  // exchanges; this weight is the notional index contribution per exchange (non-binding, owner-revisable).
  // requires_amount is FALSE, so free never carries a monetary amount — mutual aid still counts toward
  // the community economy without implying any price.
  { code: 'FREE', usdRate: 3 },
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
      for (const rate of RATES) {
        await client.query(
          `INSERT INTO currency_usd_rates (currency_code, usd_rate, as_of, source)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (currency_code, as_of) DO UPDATE SET usd_rate = EXCLUDED.usd_rate, source = EXCLUDED.source`,
          [rate.code, rate.usdRate, AS_OF, SOURCE],
        );
      }
      await client.query('COMMIT');
      console.log(`Seeded ${RATES.length} currency_usd_rates (as_of ${AS_OF}).`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
