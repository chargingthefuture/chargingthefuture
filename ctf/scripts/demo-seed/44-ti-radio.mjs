// TI Radio demo data for "Coming up on TI Radio" in Chyme (CH-22) and the guide: three booked slots
// hosted by synthetic members in the coming days. Slot times are worked out from NOW() on every run,
// on the guide's 90-minute grid counted from midnight UTC, and each lands on the first free slot at
// or after its target so a booking somebody made in the demo is never displaced.
const id = (n) => `ddd00000-0000-4000-8440-0000000000${n.toString(16).padStart(2, '0')}`;

export default async function seed(client, ctx) {
  // [n, host, handle, title, description, slots ahead of the current one]
  const slots = [
    [1, ctx.PEER_1, 'alex_rivera', 'Finding work with flexible hours',
      'Jobs, side work and schedules that bend. Bring what has worked for you.', 2],
    [2, ctx.PEER_2, 'jordan_kim', 'Filling out forms without losing a day',
      'Benefits, housing and ID paperwork. We go through the parts that trip people up.', 14],
    [3, ctx.HOST, 'pat_morgan', 'Cooking cheap and simple this week',
      'A few meals that need one pot and no oven. Swap your own.', 27],
  ];

  for (const [n, host, handle, title, description, ahead] of slots) {
    await client.query(
      `WITH grid AS (
         SELECT (date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
                + (k * INTERVAL '90 minutes') AS s
           FROM generate_series(0, 16 * 8) AS k
       ),
       current_slot AS (
         SELECT MAX(s) AS s FROM grid WHERE s <= NOW()
       ),
       chosen AS (
         SELECT g.s FROM grid g, current_slot c
          WHERE g.s >= c.s + ($2::int * INTERVAL '90 minutes')
            AND NOT EXISTS (
              SELECT 1 FROM ti_radio_slots t
               WHERE t.status = 'booked' AND t.slot_start_utc = g.s AND t.id <> $1::uuid)
          ORDER BY g.s LIMIT 1
       )
       INSERT INTO ti_radio_slots (id, slot_start_utc, host_user_id, host_username, title, description, status)
       SELECT $1::uuid, chosen.s, $3, $4, $5, $6, 'booked' FROM chosen
       ON CONFLICT (id) DO UPDATE SET
         slot_start_utc = EXCLUDED.slot_start_utc, host_user_id = EXCLUDED.host_user_id,
         host_username = EXCLUDED.host_username, title = EXCLUDED.title, description = EXCLUDED.description,
         status = 'booked', released_at = NULL, removed_by = NULL, removed_at = NULL, removal_reason = NULL,
         updated_at = NOW()`,
      [id(n), ahead, host, handle, title, description],
    );
  }
}
