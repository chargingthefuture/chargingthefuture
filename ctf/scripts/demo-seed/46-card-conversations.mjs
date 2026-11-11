// Sample conversations under the sample ride and Skill Up cards that signed-out Today shows (owner
// decision, 2026-11-10): a visitor opening one sees what a conversation on a card looks like, marked
// as sample, and never a member's words. Two or three public messages each, from synthetic members,
// on the open demo rides and cohorts; a re-run puts the same messages back. No Just us two message
// is written.
const AUTHORS = ['dpsmp-01', 'dpsmp-02', 'dpsmp-03'];

const RIDE_TALK = [
  'I can drive on Thursday morning. Is that early enough?',
  'Thursday works. I will accept your offer so we can sort out the details.',
  'If Thursday falls through I have Saturday free too.',
];

const COHORT_TALK = [
  'Is this one fine for somebody who has never done it before?',
  'Yes, the first two sessions start from nothing.',
  'Joined. See you at the first session.',
];

const pad = (n) => n.toString(16).padStart(4, '0');
const messageId = (group, n) => `ddd00000-0000-4000-8460-${group}${pad(n)}00000`.slice(0, 36);

async function talk(client, plugin, itemId, lines, group, start) {
  let n = start;
  for (const [index, body] of lines.entries()) {
    n += 1;
    await client.query(
      `INSERT INTO commons_item_messages (id, plugin, item_id, author_id, body, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5, NOW() - ($6 || ' hours')::interval)
       ON CONFLICT (id) DO UPDATE SET plugin = EXCLUDED.plugin, item_id = EXCLUDED.item_id, body = EXCLUDED.body,
         created_at = EXCLUDED.created_at, moderation_status = 'accepted'`,
      [messageId(group, n), plugin, itemId, AUTHORS[index % AUTHORS.length], body, String(lines.length - index)],
    );
  }
  return n;
}

export default async function seed(client) {
  await client.query(`DELETE FROM commons_item_messages WHERE author_id = ANY($1::text[])`, [AUTHORS]);
  const rides = await client.query(`SELECT id::text AS id FROM trust_transport_requests WHERE status = 'open' ORDER BY id LIMIT 5`);
  const cohorts = await client.query(`SELECT id::text AS id FROM skill_up_cohorts WHERE status = 'open' ORDER BY id LIMIT 5`);
  let n = 0;
  for (const ride of rides.rows) n = await talk(client, 'trust-transport', ride.id, RIDE_TALK, '0001', n);
  let m = 0;
  for (const cohort of cohorts.rows) m = await talk(client, 'skill-up', cohort.id, COHORT_TALK, '0002', m);
  console.log(`  ✓ demo-seed card conversations (${rides.rows.length} rides, ${cohorts.rows.length} cohorts)`);
}
