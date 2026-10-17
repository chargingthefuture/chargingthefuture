// ServiceCredits demo extras: community credit switched on in the demo treasury policy and a
// 20-credit line for the demo owner and the admin demo account (SC-5), so the wallet names the owner's floor and the send form
// offers the mutual-credit option. Both are Postgres rows the wallet reads directly; nothing here
// touches the external ledger. Every other account keeps a limit of 0.

export default async function seed(client, ctx) {
  const { PERSONAL_ACCOUNTS, ADMIN } = ctx;

  // Merged into whatever policy the demo treasury already holds, so only the community-credit keys
  // are put back on a re-run.
  const mutualCredit = { mutualCredit: { enabled: true, defaultLimit: 0, maxLimit: 100 } };
  await client.query(
    `INSERT INTO service_credits_treasury_config (id, policy, updated_by_user_id, updated_at)
     VALUES (TRUE, $1::jsonb, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET
       policy = service_credits_treasury_config.policy || EXCLUDED.policy,
       updated_at = NOW()`,
    [JSON.stringify(mutualCredit), ADMIN],
  );

  for (const account of PERSONAL_ACCOUNTS) {
    await client.query(
      `INSERT INTO service_credits_credit_limits (user_id, credit_limit, updated_by_user_id, updated_at)
       VALUES ($1, 20, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         credit_limit = EXCLUDED.credit_limit, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = NOW()`,
      [account, ADMIN],
    );
  }

  console.log('  ✓ demo-seed service-credits (community credit on, a line of 20 for each personal account)');
}
