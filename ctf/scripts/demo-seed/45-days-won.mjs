// Days won: room minutes for six synthetic members over the 120 days before the seed runs, so
// signed-out Today, which reads Days won from the demo schema, shows a sample total rather than 0.
// Days won is all members' action minutes ÷ 480 (lib/measures/action-minutes.ts); this writes only
// room seconds, the simplest of its three sources. Each member's minutes on a day come from a fixed
// pattern, so a re-run writes the same amounts on the same days relative to now. "This week" is the
// last seven of those days, so it reads 0 once a week has passed without a re-seed.
const MEMBERS = ['demo-peer-days-01', 'demo-peer-days-02', 'demo-peer-days-03', 'demo-peer-days-04', 'demo-peer-days-05', 'demo-peer-days-06'];
const DAYS_BACK = 120;
// Minutes in a room, cycled per member and day; 0 is a day the member was not in a room.
const PATTERN = [45, 0, 30, 90, 0, 60, 20, 0, 75, 40, 0, 55];

export function daysWonRows(today = new Date()) {
  const rows = [];
  for (let back = 0; back < DAYS_BACK; back += 1) {
    const day = new Date(today.getTime() - back * 86_400_000).toISOString().slice(0, 10);
    MEMBERS.forEach((userId, index) => {
      const minutes = PATTERN[(back * 5 + index * 7) % PATTERN.length];
      if (minutes > 0) rows.push({ userId, day, seconds: minutes * 60 });
    });
  }
  return rows;
}

export default async function seed(client) {
  await client.query(`DELETE FROM member_action_seconds_daily WHERE user_id = ANY($1::text[])`, [MEMBERS]);
  const rows = daysWonRows();
  for (const row of rows) {
    await client.query(
      `INSERT INTO member_action_seconds_daily (user_id, usage_date, source, seconds, updated_at)
       VALUES ($1, $2::date, 'chyme-room', $3, NOW())
       ON CONFLICT (user_id, usage_date, source) DO UPDATE SET seconds = EXCLUDED.seconds, updated_at = NOW()`,
      [row.userId, row.day, row.seconds],
    );
  }

  console.log(`  ✓ demo-seed days won (${rows.length} days of room minutes for ${MEMBERS.length} members)`);
}
