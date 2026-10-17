// TrustTransport demo repair: each account's completed ride (Oakland to San Francisco, written by
// seedDemo.mjs) belongs to that account. seedDemo.mjs keeps the owner's fixed request id, and its
// upsert leaves requester_user_id alone, so a demo schema first seeded with a different
// DEMO_OWNER_ID kept the ride under that earlier account and the Tracking tab read "No active
// trips". Writes no new rows; a re-run changes nothing once they match.
export default async function seed(client, ctx) {
  for (const account of ctx.PERSONAL_ACCOUNTS) {
    await client.query(
      `UPDATE trust_transport_requests SET requester_user_id = $2, updated_at = NOW()
       WHERE id = $1::uuid AND requester_user_id <> $2`,
      [ctx.personalId(account, ctx.ID.ttRequest), account],
    );
  }

  console.log('  ✓ demo-seed trust-transport (rides handed back to their accounts)');
}
