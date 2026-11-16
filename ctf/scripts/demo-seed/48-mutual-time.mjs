// Mutual Time demo data for the "Offer · hours" previews on signed-out Today, which read surveys open
// for picking right now (lib/mutual-time/open-events.ts, listOpenEvents, through hoursOffers). Six open
// surveys by synthetic members nobody can sign in as, each offering an hour of help: tutoring,
// cooking, a repair, a ride, moving help and paperwork. Each opened within the last two days and
// closes a week after the seed runs, so every re-run keeps them open. Fixed slugs, so each shared
// link stays the same.

const id = (n) => `ddd00000-0000-4000-8480-0000000000${n.toString(16).padStart(2, '0')}`;

const ROSA = 'demo-peer-mutual-time-01';
const LEE = 'demo-peer-mutual-time-02';
const NOOR = 'demo-peer-mutual-time-03';

// [n, creator, slug, title, description, meetingPlugin, hoursAgo]
const OFFERS = [
  [1, ROSA, 'an-hour-of-math-tutoring-demo', 'An hour of math tutoring',
    'Fractions, percentages or getting ready for a GED test. Pick the times that suit you and we will go over what you are stuck on.',
    'peer-programming', 1],
  [2, LEE, 'cook-a-week-of-meals-together-demo', 'Cook a week of meals together',
    'One afternoon to plan and cook five simple dinners on a small budget. Bring a list of what you have.',
    'chyme', 5],
  [3, NOOR, 'help-fixing-a-bike-or-small-repair-demo', 'Help with a bike or a small repair',
    'A flat tire, a loose chain, a wobbly chair or a drawer that sticks. We start on a call and see what it needs.',
    'peer-programming', 9],
  [4, ROSA, 'rides-to-appointments-this-week-demo', 'Rides to appointments this week',
    'I have a car and a few free hours. Pick the times that work and we will sort out where on a call.',
    'chyme', 16],
  [5, LEE, 'two-hours-of-moving-help-demo', 'Two hours of moving help',
    'Carrying boxes and furniture, or packing a room. Pick a time and we will plan it on a call first.',
    'beacon', 24],
  [6, NOOR, 'go-through-paperwork-together-demo', 'Go through paperwork together',
    'Benefit forms, a lease or a letter that needs an answer. An hour on a call, reading it through together.',
    'peer-programming', 36],
];

export default async function seed(client) {
  for (const [n, creator, slug, title, description, meetingPlugin, hoursAgo] of OFFERS) {
    await client.query(
      `INSERT INTO mutual_time_events
         (id, slug, created_by_user_id, title, description, meeting_plugin, window_start_date, window_days,
          opens_at, closes_at, status, result_slot_start, result_can_make_it, created_at, closed_at, auto_closed)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, CURRENT_DATE, 7,
          NOW() - ($7::int * INTERVAL '1 hour'), NOW() + INTERVAL '7 days', 'open', NULL, NULL,
          NOW() - ($7::int * INTERVAL '1 hour'), NULL, false)
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug, created_by_user_id = EXCLUDED.created_by_user_id, title = EXCLUDED.title,
         description = EXCLUDED.description, meeting_plugin = EXCLUDED.meeting_plugin,
         window_start_date = EXCLUDED.window_start_date, window_days = EXCLUDED.window_days,
         opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at, status = 'open',
         result_slot_start = NULL, result_can_make_it = NULL, created_at = EXCLUDED.created_at,
         closed_at = NULL, auto_closed = false`,
      [id(n), slug, creator, title, description, meetingPlugin, hoursAgo],
    );
  }
}
