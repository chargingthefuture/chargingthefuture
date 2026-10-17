// Contributions demo extras for the demo owner, on top of the Quora comment and GitHub star
// seedDemo.mjs creates:
//   - a third claim, a gift card waiting for review (CONT-8). It records a claimed card value only:
//     nothing is confirmed, no money is counted toward the drive, and the Signal contact is a
//     placeholder that is never shown on the member screen;
//   - the GitHub star moved to confirmed with its thank-you credits, so the star path reads as
//     already credited (CONT-6). Credits are not money.

const GIFT_CARD_CLAIM = 'ddd00000-0000-4000-8330-000000000001';

export default async function seed(client, ctx) {
  const { OWNER, ADMIN, ID } = ctx;

  await client.query(
    `INSERT INTO contributions_submissions
     (id, user_id, kind, method, claimed_amount_usd, signal_contact, status, cycle_id, created_at)
     VALUES ($1::uuid, $2, 'gift_card', 'amazon', 10, 'demo-signal-placeholder', 'pending', $3::uuid,
       NOW() - INTERVAL '1 day')
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id, kind = EXCLUDED.kind, method = EXCLUDED.method,
       claimed_amount_usd = EXCLUDED.claimed_amount_usd, signal_contact = EXCLUDED.signal_contact,
       status = 'pending', confirmed_amount_usd = NULL, credits_granted = 0,
       reviewed_by_user_id = NULL, reviewed_at = NULL, review_note = NULL,
       cycle_id = EXCLUDED.cycle_id, created_at = EXCLUDED.created_at, updated_at = NOW()`,
    [GIFT_CARD_CLAIM, OWNER, ID.contribCycle],
  );

  // One star unit at the default rate (non_monetary_unit_value_usd 1 x credits_per_usd 10), the
  // same figures a review writes.
  await client.query(
    `UPDATE contributions_submissions
     SET status = 'confirmed', confirmed_amount_usd = 1, credits_granted = 10,
         reviewed_by_user_id = $2, reviewed_at = NOW() - INTERVAL '3 days',
         review_note = 'Star found on the repository.', updated_at = NOW()
     WHERE id = $1::uuid`,
    [ID.contribSubmission2, ADMIN],
  );

  console.log('  ✓ demo-seed contributions (gift card claim, credited star)');
}
