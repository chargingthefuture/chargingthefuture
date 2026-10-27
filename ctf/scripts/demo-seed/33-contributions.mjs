// Contributions demo extras for the demo owner and the admin demo account, on top of the confirmed
// and pending gift cards seedDemo.mjs creates:
//   - both of those claims handed to the account they are seeded for. seedDemo.mjs keeps the owner's
//     fixed claim ids, and its upsert leaves user_id alone, so a demo schema first seeded with a
//     different DEMO_OWNER_ID kept them under that earlier account and My history showed no
//     Confirmed claim;
//   - the third claim this module seeded before Contributions took gift cards only (a Signal-era gift
//     card) removed, so the demo queue matches what the app can produce now.

const OLD_SIGNAL_GIFT_CARD_CLAIM = 'ddd00000-0000-4000-8330-000000000001';

export default async function seed(client, ctx) {
  const { PERSONAL_ACCOUNTS, personalId, ID } = ctx;

  for (const account of PERSONAL_ACCOUNTS) {
    await client.query(
      `UPDATE contributions_submissions SET user_id = $2, updated_at = NOW()
       WHERE id = ANY($1::uuid[]) AND user_id <> $2`,
      [[personalId(account, ID.contribSubmission1), personalId(account, ID.contribSubmission2)], account],
    );

    await client.query(`DELETE FROM contributions_submissions WHERE id = $1::uuid`, [personalId(account, OLD_SIGNAL_GIFT_CARD_CLAIM)]);
  }

  console.log('  ✓ demo-seed contributions (claims owned by their account)');
}
