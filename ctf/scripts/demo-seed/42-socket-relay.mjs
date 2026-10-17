// SocketRelay demo data for the feed cases (SR-1, SR-2): seven open requests posted by synthetic
// members, each with one to three tags, so the "All" feed has other people's cards to read and the
// tag chips have several tags to rank. One names ServiceCredits, one Free and one Barter, so the
// settlement badge shows each kind. All are within their 28 days, so they also count toward the GDP
// "Value waiting to happen" panel (GDP-12). Nothing here needs the optional second owner account.
const id = (n) => `ddd00000-0000-4000-8420-0000000000${n.toString(16).padStart(2, '0')}`;

export default async function seed(client, ctx) {
  const MARIA = 'demo-peer-socket-relay-01';
  const SAM = 'demo-peer-socket-relay-02';
  const DANA = 'demo-peer-socket-relay-03';

  const people = [
    [ctx.PEER_2, 'I can read things over and help with forms.'],
    [MARIA, 'New to the area and could use a hand now and then.'],
    [SAM, 'Handy with tools. Will trade for help with tech.'],
    [DANA, 'Out most weekends running errands.'],
  ];
  for (const [userId, bio] of people) {
    await client.query(
      `INSERT INTO socket_relay_user_extension (user_id, bio, relay_preferences, presence_opt_in)
       VALUES ($1, $2, '{"notifications":"all"}'::jsonb, true)
       ON CONFLICT (user_id) DO UPDATE SET
         bio = EXCLUDED.bio, presence_opt_in = true, service_deleted_at = NULL, updated_at = NOW()`,
      [userId, bio],
    );
  }

  // [n, owner, username, title, details, tags, city, priceCurrency, priceAmount, hoursAgo]
  const requests = [
    [1, ctx.PEER_1, 'alex_rivera', 'Ride to a job interview on Tuesday',
      'Interview at 10 in the morning across town. Need a ride there; I can get the bus back.',
      ['rides', 'jobs'], 'Oakland', null, null, 3],
    [2, ctx.PEER_2, 'jordan_kim', 'Someone to read over a cover letter',
      'One page, for a warehouse job. Looking for a second pair of eyes on spelling and tone.',
      ['writing', 'jobs'], 'Toronto', 'FREE', null, 9],
    [3, MARIA, 'maria_lopez', 'Help setting up a new phone',
      'Moving contacts and photos from an old phone to a new one. About an hour at a library or cafe.',
      ['tech help'], 'Berkeley', 'SC', 20, 20],
    [4, SAM, 'sam_carter', 'Borrow a ladder for an afternoon',
      'Need a six-foot ladder to change a ceiling light. Can trade a hand with a small repair.',
      ['tools', 'home'], 'Oakland', 'BARTER', null, 30],
    [5, DANA, 'dana_brooks', 'Pick up groceries on Saturday',
      'A short list from the store on Grand Avenue. I will send the list the day before.',
      ['errands', 'food'], 'Oakland', null, null, 44],
    [6, ctx.PEER_2, 'jordan_kim', 'Carry a couch up one flight of stairs',
      'Two people for fifteen minutes on Sunday afternoon.',
      ['moving', 'home'], 'Toronto', null, null, 60],
    [7, MARIA, 'maria_lopez', 'Company for a trip to the laundromat',
      'Thursday evening, about an hour. Mostly someone to talk to while it runs.',
      ['errands'], 'Berkeley', null, null, 80],
  ];

  for (const [n, owner, username, title, details, tags, city, currency, amount, hoursAgo] of requests) {
    await client.query(
      `INSERT INTO socket_relay_requests
         (id, owner_user_id, owner_username, title, details, category, tags, city, country, is_public, status,
          idempotency_key, reopened_count, claimed_fulfillment_id, price_currency, price_amount,
          created_at, updated_at, expires_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::text[], $8, $9, true, 'open',
          $10, 0, NULL, $11, $12,
          NOW() - ($13::int * INTERVAL '1 hour'), NOW() - ($13::int * INTERVAL '1 hour'),
          NOW() - ($13::int * INTERVAL '1 hour') + INTERVAL '28 days')
       ON CONFLICT (id) DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id, owner_username = EXCLUDED.owner_username,
         title = EXCLUDED.title, details = EXCLUDED.details, category = EXCLUDED.category,
         tags = EXCLUDED.tags, city = EXCLUDED.city, country = EXCLUDED.country, is_public = true,
         status = 'open', reopened_count = 0, claimed_fulfillment_id = NULL,
         price_currency = EXCLUDED.price_currency, price_amount = EXCLUDED.price_amount,
         created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at`,
      [id(n), owner, username, title, details, tags[0], tags, city,
        city === 'Toronto' ? 'Canada' : 'United States', `demo-sr-feed-${n}`, currency, amount, hoursAgo],
    );
  }
}
