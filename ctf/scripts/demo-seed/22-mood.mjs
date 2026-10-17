// Mood: enough check-ins in the last seven days for the Community Pulse to show its chart (MD-5).
// The pulse withholds everything below 5 check-ins in the window and leaves out any day with fewer
// than 3 (lib/mood/constants.ts), so this writes twelve check-ins from twelve synthetic members,
// four on each of three days, 1, 3 and 5 days back. Each member checks in once, the same as the
// seven-day cooldown allows a real one.
//
// Rows are stored the way the app stores them: the check-in carries an empty user_id and the
// member's pseudonym, and the only link back to the member is the mood_client_identities row. No
// notes, because the pulse never reads one. A re-run moves the check-ins back to the same days
// relative to now, so the chart stays full whenever the seed was last run.
const pad = (n) => n.toString(16).padStart(2, '0');
const identityId = (n) => `ddd00000-0000-4000-8220-0000000000${pad(n)}`;
const submissionId = (n) => `ddd00000-0000-4000-8220-0000000001${pad(n)}`;

// [days ago, mood values for the four members that day]
const DAYS = [
  [1, [4, 3, 4, 5]],
  [3, [3, 4, 2, 4]],
  [5, [4, 4, 3, 3]],
];

export default async function seed(client) {
  let n = 0;
  for (const [daysAgo, values] of DAYS) {
    for (const value of values) {
      n += 1;
      const userId = `demo-peer-mood-${String(n).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO mood_client_identities (pseudonym, user_id)
         VALUES ($1::uuid, $2)
         ON CONFLICT (user_id) DO UPDATE SET pseudonym = EXCLUDED.pseudonym`,
        [identityId(n), userId],
      );
      // Midday of the day in question, so the check-in lands on that calendar day in UTC whatever
      // time the seed runs.
      await client.query(
        `INSERT INTO mood_submissions (id, user_id, client_id, mood_value, note, submitted_at, pseudonym)
         VALUES ($1::uuid, '', 'demo-client', $2, NULL,
                 date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                   - make_interval(days => $3::int) + INTERVAL '12 hours',
                 $4::uuid)
         ON CONFLICT (id) DO UPDATE SET
           mood_value = EXCLUDED.mood_value,
           note = NULL,
           submitted_at = EXCLUDED.submitted_at,
           pseudonym = EXCLUDED.pseudonym`,
        [submissionId(n), value, daysAgo, identityId(n)],
      );
    }
  }

  console.log(`  ✓ demo-seed mood (${n} check-ins over 3 days for the Community Pulse)`);
}
