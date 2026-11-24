// Activity (3.1): eight notices for each demo account, so its Activity screen is full on the first
// visit. Activity reads only the notifications table, and nothing else in the seed writes it.
//
// - Needs you: wes_h asks to talk just you two on his open ride (written by 49-today-abundance.mjs),
//   with the request row behind it, so Agree works from Activity.
// - Today: a 21 Questions buddy message, a mention and a reply in the Commons (posts from
//   20-commons.mjs), all in the last hour, so they stay under Today whenever the seed runs.
// - Earlier: the 50 ServiceCredits seedDemo.mjs sends each account, two more buddy messages, and a
//   just-you-two message from xena_r on her ride, whose request is already agreed.
//
// Summaries are the app's own wording for each notice. Times are relative to the run. Ids are fixed
// per account (personalId), and a re-run puts every notice back unread or read as listed here.
const base = (n) => `ddd00000-0000-4000-8500-0000000000${n.toString(16).padStart(2, '0')}`;
const RIDE_1 = 'ddd00000-0000-4000-8490-000000000001';
const RIDE_2 = 'ddd00000-0000-4000-8490-000000000002';
const POST_2 = 'ddd00000-0000-4000-8200-000000000002';
const POST_3 = 'ddd00000-0000-4000-8200-000000000003';
const WES = 'demo-peer-mood-01';
const XENA = 'demo-peer-mood-02';

// [n, plugin, type, category, summary, linkPath, targetRef (null or (account) => ref), minutesAgo, read]
const NOTICES = [
  [1, 'today', 'today.card.pair_request', 'community', 'wes_h asked to talk just you two on a card in Today.',
    '/', () => `trust-transport:${RIDE_1}|${WES}`, 90, false],
  [2, 'questions', 'questions.match.message', 'community',
    'New message from your 21 Questions buddy. You and @mina_d answered 5 of 8 the same.', '/', null, 5, false],
  [3, 'commons', 'commons.mention', 'community', 'Someone mentioned you in the Commons.',
    `/?post=${POST_2}`, null, 20, false],
  [4, 'commons', 'commons.reply', 'community', 'Someone replied to your post in the Commons.',
    `/?post=${POST_3}`, null, 45, true],
  [5, 'questions', 'questions.match.message', 'community',
    'New message from your 21 Questions buddy. You and @olive_r answered 6 of 8 the same.', '/', null, 26 * 60, true],
  [6, 'today', 'today.card.pair_message', 'community', 'New message from xena_r, just you two, on a card in Today.',
    '/', null, 2 * 24 * 60, true],
  [7, 'service-credits', 'service-credits.received', 'activity', 'You received 50 ServiceCredits.',
    '/apps/service-credits', null, 3 * 24 * 60, true],
  [8, 'questions', 'questions.match.message', 'community',
    'New message from your 21 Questions buddy. You and @nate_k answered 5 of 8 the same.', '/', null, 4 * 24 * 60, true],
];

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

// wes_h waits on the account; xena_r and the account already agreed two days ago.
async function seedPairRequests(client, account) {
  for (const [ride, requester, agreedDaysAgo] of [[RIDE_1, WES, null], [RIDE_2, XENA, 2]]) {
    const [low, high] = pair(account, requester);
    await client.query(
      `INSERT INTO commons_item_pair_requests (plugin, item_id, user_low, user_high, requester_id, created_at, agreed_at)
       VALUES ('trust-transport', $1, $2, $3, $4,
         NOW() - (COALESCE($5::int, 0) * INTERVAL '1 day') - INTERVAL '2 hours',
         CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() - ($5::int * INTERVAL '1 day') - INTERVAL '1 hour' END)
       ON CONFLICT (plugin, item_id, user_low, user_high) DO UPDATE SET
         requester_id = EXCLUDED.requester_id, created_at = EXCLUDED.created_at, agreed_at = EXCLUDED.agreed_at`,
      [ride, low, high, requester, agreedDaysAgo],
    );
  }
}

async function seedNotices(client, account, personalId) {
  for (const [n, plugin, type, category, summary, linkPath, ref, minutesAgo, read] of NOTICES) {
    const id = personalId(account, base(n));
    const targetRef = ref ? ref(account) : null;
    // A notice the app already sent for the same thing would hit the (user, type, target) index.
    if (targetRef) {
      await client.query(
        `DELETE FROM notifications WHERE user_id = $1 AND notification_type = $2 AND target_ref = $3 AND id <> $4::uuid`,
        [account, type, targetRef, id],
      );
    }
    await client.query(
      `INSERT INTO notifications (id, user_id, source_plugin, notification_type, category, summary, link_path, target_ref, read_at, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8,
         CASE WHEN $10::boolean THEN NOW() - ($9::int * INTERVAL '1 minute') + INTERVAL '1 minute' ELSE NULL END,
         NOW() - ($9::int * INTERVAL '1 minute'))
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id, source_plugin = EXCLUDED.source_plugin, notification_type = EXCLUDED.notification_type,
         category = EXCLUDED.category, summary = EXCLUDED.summary, link_path = EXCLUDED.link_path,
         target_ref = EXCLUDED.target_ref, read_at = EXCLUDED.read_at, created_at = EXCLUDED.created_at`,
      [id, account, plugin, type, category, summary, linkPath, targetRef, minutesAgo, read],
    );
  }
}

export default async function seed(client, ctx) {
  for (const account of ctx.PERSONAL_ACCOUNTS) {
    await seedPairRequests(client, account);
    await seedNotices(client, account, ctx.personalId);
  }
  console.log(`  ✓ demo-seed activity (${NOTICES.length} notices for each of ${ctx.PERSONAL_ACCOUNTS.length} accounts)`);
}
