// Today card abundance: enough rows that every 3.1 Today card kind shows at least three cards for a
// demo account and on signed-out Today, which reads asks and offers from this schema. The other
// modules already give offers (six hours, six places), SocketRelay asks (twelve), What Works problems
// and Commons posts; this one tops up what was short:
//
// - rides wanted: three open requests by synthetic members, whatever accounts are switched on
//   (seedDemo.mjs writes its two only when a second account exists);
// - goals: two more on the standing goal board, by two synthetic members who join it here;
// - stories: a third announcement from the System Architect;
// - 21 Questions buddies: four synthetic members answer every question, and each demo account
//   answers the first eight, so each account has buddies from its first visit. The rest stay
//   unanswered for the question card. A member's own answers are final, so a re-run leaves an
//   answer the account already gave as it is.
//
// Every id is fixed (ddd00000-…-8490-…), and every statement puts the row back to this state.
const id = (n) => `ddd00000-0000-4000-8490-0000000000${n.toString(16).padStart(2, '0')}`;

// [n, requester, title, details, pickup, dropoff, hoursAgo]
const RIDES = [
  [1, 'demo-peer-mood-01', 'Ride to a dentist appointment',
    'Tuesday morning, about forty minutes each way. I can cover gas or trade an hour of sewing repairs.',
    'Fresno', 'Clovis', 3],
  [2, 'demo-peer-mood-02', 'Ride to the food bank on Saturday',
    'Picking up a box for the week. It is heavy and the bus does not run there on weekends.',
    'Tacoma', 'Lakewood', 8],
  [3, 'demo-peer-mood-03', 'Ride to sign a new lease',
    'One trip with two bags to the leasing office. A daytime ride with somebody quiet is ideal.',
    'Columbus', 'Westerville', 14],
];

// [n, owner, title]
const GOALS = [
  [11, 'demo-peer-days-01', 'A laptop that works for remote bookkeeping work'],
  [12, 'demo-peer-days-02', 'A ground-floor room in Atlanta before the end of the month'],
];

const ANNOUNCEMENT = [
  21,
  'Rides and places to stay are on Today',
  'Somebody offering a ride, a couch for a few nights or an hour of their time now shows on Today, next to what people are asking for. Mark one done when it is settled.',
];

const BUDDIES = ['demo-peer-workforce-01', 'demo-peer-workforce-02', 'demo-peer-workforce-03', 'demo-peer-workforce-04'];

// The 21 questions in bank order (SE_QUESTIONS in @ctf/shared), each with four choices.
const QUESTIONS = Array.from({ length: 21 }, (_, i) => `q${43 + i}`);
const VIEWER_ANSWERED = 8;

const viewerChoice = (i) => i % 4;
// Buddy k agrees with the demo accounts on two out of every three of the first eight questions, a
// different two for each buddy, so each has five or six in common and they rank differently. Every
// other answer differs from theirs.
const buddyChoice = (k, i) => (i < VIEWER_ANSWERED && i % 3 !== k % 3 ? viewerChoice(i) : (i + 1 + (k % 3)) % 4);

async function seedRides(client) {
  for (const [n, requester, title, details, pickup, dropoff, hoursAgo] of RIDES) {
    await client.query(
      `INSERT INTO trust_transport_requests
       (id, requester_user_id, mode, title, details, pickup_city, dropoff_city,
        pickup_geo_redacted, dropoff_geo_redacted, status, created_at, updated_at)
       VALUES ($1::uuid, $2, 'rideshare', $3, $4, $5, $6, $7, $8, 'open',
         NOW() - ($9::int * INTERVAL '1 hour'), NOW() - ($9::int * INTERVAL '1 hour'))
       ON CONFLICT (id) DO UPDATE SET
         requester_user_id = EXCLUDED.requester_user_id, title = EXCLUDED.title, details = EXCLUDED.details,
         pickup_city = EXCLUDED.pickup_city, dropoff_city = EXCLUDED.dropoff_city, status = 'open',
         created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at`,
      [id(n), requester, title, details, pickup, dropoff, `${pickup} (redacted)`, `${dropoff} (redacted)`, hoursAgo],
    );
  }
}

async function seedGoals(client) {
  const standing = await client.query(`SELECT id FROM peer_programming_cohorts WHERE is_standing = TRUE LIMIT 1`);
  const cohortId = standing.rows[0]?.id;
  if (!cohortId) throw new Error('today-abundance: no standing goal board; seedDemo.mjs writes it first');
  for (const [n, owner, title] of GOALS) {
    await client.query(
      `INSERT INTO peer_programming_cohort_members (cohort_id, user_id)
       VALUES ($1::uuid, $2)
       ON CONFLICT (cohort_id, user_id) DO NOTHING`,
      [cohortId, owner],
    );
    await client.query(
      `INSERT INTO peer_programming_goals (id, cohort_id, owner_user_id, title, status, closed_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'open', NULL)
       ON CONFLICT (id) DO UPDATE SET cohort_id = EXCLUDED.cohort_id, owner_user_id = EXCLUDED.owner_user_id,
         title = EXCLUDED.title, status = 'open', closed_at = NULL, updated_at = NOW()`,
      [id(n), cohortId, owner, title],
    );
  }
}

async function seedAnnouncement(client, ADMIN) {
  const [n, title, body] = ANNOUNCEMENT;
  await client.query(
    `INSERT INTO feed_items
     (id, item_type, title, body, published_at, is_active, created_by_user_id, updated_by_user_id)
     VALUES ($1::uuid, 'announcement', $2, $3, NOW() - INTERVAL '3 hours', TRUE, $4, $4)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body,
       published_at = EXCLUDED.published_at, expires_at = NULL, is_active = TRUE, updated_at = NOW()`,
    [id(n), title, body, ADMIN],
  );
}

async function answer(client, userId, questionId, choice, daysAgo, overwrite) {
  await client.query(
    `INSERT INTO question_answers (user_id, question_id, choice, answered_at)
     VALUES ($1, $2, $3, NOW() - ($4::int * INTERVAL '1 day'))
     ON CONFLICT (user_id, question_id) DO ${overwrite ? 'UPDATE SET choice = EXCLUDED.choice, answered_at = EXCLUDED.answered_at' : 'NOTHING'}`,
    [userId, questionId, choice, daysAgo],
  );
}

async function seedBuddies(client, accounts) {
  for (const [k, buddy] of BUDDIES.entries()) {
    for (const [i, questionId] of QUESTIONS.entries()) await answer(client, buddy, questionId, buddyChoice(k, i), 21 - i, true);
  }
  for (const account of accounts) {
    for (let i = 0; i < VIEWER_ANSWERED; i += 1) await answer(client, account, QUESTIONS[i], viewerChoice(i), 21 - i, false);
  }
}

export default async function seed(client, ctx) {
  await seedRides(client);
  await seedGoals(client);
  await seedAnnouncement(client, ctx.ADMIN);
  await seedBuddies(client, ctx.PERSONAL_ACCOUNTS);
}
