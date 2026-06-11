import { Pool } from 'pg';

// Seed the `currency_usd_rates` table (issue #121). These are the notional USD conversion factors the
// GDP estimation layer uses to roll multi-currency transaction volume into one USD-denominated
// estimate. They are owner-curated estimates, not market quotes, and are revised over time (a new row
// per currency_code with a later `as_of` becomes the active rate).
//
// LEGAL GUARDRAIL: these factors are used ONLY inside the aggregate, estimate-labeled GDP figure. They
// are NEVER shown as a per-wallet or per-price fiat equivalence. ServiceCredits is deliberately NOT in
// this table — the non-redeemable utility token has no USD rate and is never converted to fiat; its
// recognized volume is reported separately in SC units (metric gdp_recognized_volume_sc).
const AS_OF = '2026-01-01';
const SOURCE = 'owner-seed';

// 1 unit of <code> is counted as <usdRate> USD inside the GDP estimate. Approximate, owner-revisable.
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
  // ServiceCredits ('SC') is intentionally NOT given a USD rate. It is a non-redeemable utility token
  // with no fiat peg or redemption value, so it is never converted to USD. Its recognized volume is
  // reported separately in SC units (metric gdp_recognized_volume_sc) and shown alongside the USD GDP.
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
