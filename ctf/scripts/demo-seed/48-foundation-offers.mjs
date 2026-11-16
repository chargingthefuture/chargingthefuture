// Foundation demo data for the "Offer · hours" cards on Today, which read members offering their time
// through Foundation (lib/foundation/offers.ts, through hoursOffers in lib/today/sources-offers.ts),
// and show as previews on signed-out Today. Six synthetic members nobody can sign in as, each with a
// claimed Directory profile, the skill they offer and a short line about it: tutoring, cooking, small
// repairs, rides, moving help and paperwork. The skills come from the demo taxonomy
// (10-skills-taxonomy.mjs). Each offer is dated within the last two days, so they lead the hours
// cards; nothing here is real.

const profileId = (n) => `ddd00000-0000-4000-8480-0000000000${n.toString(16).padStart(2, '0')}`;
const skillId = (n) => `ddd00000-0000-4000-8100-${n.toString(16).padStart(12, '0')}`;

// [n, user, first, last, headline, short line, country, skill, hoursAgo]
const OFFERS = [
  [1, 'demo-peer-foundation-01', 'Rosa', 'M.', 'Math tutor',
    'An hour of math help: fractions, percentages or getting ready for a GED test.',
    'United States', 0x7f, 1],
  [2, 'demo-peer-foundation-02', 'Lee', 'T.', 'Home cook',
    'Plan and cook a week of simple dinners together on a small budget.',
    'Canada', 0x46, 5],
  [3, 'demo-peer-foundation-03', 'Noor', 'A.', 'Handy with small repairs',
    'A sticking door, a loose shelf or a dripping tap. I can talk you through it or come by.',
    'United States', 0x5a, 9],
  [4, 'demo-peer-foundation-04', 'Sam', 'O.', 'Driver with a car most afternoons',
    'Rides to appointments and the store on weekday afternoons.',
    'United States', 0x65, 16],
  [5, 'demo-peer-foundation-05', 'Dana', 'K.', 'Strong back, free weekends',
    'Two hours of moving help: carrying boxes, loading a van or packing a room.',
    'United States', 0x69, 24],
  [6, 'demo-peer-foundation-06', 'Eli', 'R.', 'Good with forms',
    'Go through benefit forms, a lease or a letter that needs an answer, together.',
    'Canada', 0x78, 36],
];

export default async function seed(client) {
  for (const [n, userId, first, last, headline, line, country, skill, hoursAgo] of OFFERS) {
    await client.query(
      `INSERT INTO directory_profiles (id, claimed_by_user_id, first_name, last_name, headline, bio, country, source)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'self')
       ON CONFLICT (id) DO UPDATE SET
         claimed_by_user_id = EXCLUDED.claimed_by_user_id, first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name, headline = EXCLUDED.headline, bio = EXCLUDED.bio,
         country = EXCLUDED.country, updated_at = NOW()`,
      [profileId(n), userId, first, last, headline, line, country],
    );
    await client.query(
      `INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
       VALUES ($1::uuid, $2::uuid, 0)
       ON CONFLICT (profile_id, skill_id) DO NOTHING`,
      [profileId(n), skillId(skill)],
    );
    await client.query(
      `INSERT INTO foundation_user_extension (user_id, profile_visibility, short_description, updated_at)
       VALUES ($1, 'workspace', $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         short_description = EXCLUDED.short_description, service_deleted_at = NULL, updated_at = NOW()`,
      [userId, line],
    );
    await client.query(
      `INSERT INTO foundation_provider_skills (user_id, skill_id, created_at)
       VALUES ($1, $2::uuid, NOW() - ($3::int * INTERVAL '1 hour'))
       ON CONFLICT (user_id, skill_id) DO UPDATE SET created_at = EXCLUDED.created_at`,
      [userId, skillId(skill), hoursAgo],
    );
  }
}
