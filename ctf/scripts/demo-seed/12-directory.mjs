// Directory demo data for three member-facing cases:
//   DIR-8  Maya Thompson, a claimed profile whose member holds the Weavers of the Commons badge
//          (contributor_access_eligibility: eligible, not revoked). Jordan Kim (base seed, claimed)
//          is the non-holder, and the unclaimed profiles below show nothing badge-related.
//   DIR-3  Maya's profile also carries a member-added skill not in the taxonomy, "Bulk food buying",
//          which shows as a "pending review" chip beside her taxonomy skills.
//   DIR-12 Three private invitations, each for a community-generated listing this module creates,
//          so an approved member sees the invitation wall and "See the live listing" opens a profile.
//
// Ids: ddd00000-0000-4000-8120-0000000000XX (profiles 01-04, proposed skill 10, invites 20-22).
// Synthetic member: demo-peer-directory-01. Invite handles and Quora addresses are made up.
import { TAXONOMY_IDS } from './10-skills-taxonomy.mjs';

const id = (n) => `ddd00000-0000-4000-8120-${n.toString(16).padStart(12, '0')}`;
const BADGE_HOLDER = 'demo-peer-directory-01';

function skill(key) {
  const value = TAXONOMY_IDS.skills[key];
  if (!value) throw new Error(`12-directory: skill "${key}" is not in 10-skills-taxonomy.mjs.`);
  return value;
}

function jobTitle(name) {
  const value = TAXONOMY_IDS.jobTitles[name];
  if (!value) throw new Error(`12-directory: job title "${name}" is not in 10-skills-taxonomy.mjs.`);
  return value;
}

// [id, claimed by, handle when unclaimed, first, last, headline, bio, city, state, country,
//  days since last update, main job title, skills]
const PROFILES = [
  [0x01, BADGE_HOLDER, null, 'Maya', 'Thompson', 'Community kitchen organizer',
    'I run a weekly shared meal and help neighbors plan food on a tight budget.',
    'Milwaukee', 'Wisconsin', 'United States', 1, 'Chefs and Cooks',
    ['Chefs and Cooks › Cooking for large groups', 'Chefs and Cooks › Meal planning', 'Food Processing Workers › Food safety handling']],
  [0x02, null, 'community-d12a02', 'Rosa', 'Delgado', 'Seamstress',
    'Alterations and mending; teaches basic sewing.',
    'San Antonio', 'Texas', 'United States', 7, 'Teaching Assistants',
    ['Teaching Assistants › Classroom support']],
  [0x03, null, 'community-d12a03', 'Daniel', 'Brooks', 'Electrician',
    'Residential wiring and small repairs.',
    'Raleigh', 'North Carolina', 'United States', 7, 'Electricians',
    ['Electricians › Residential wiring', 'Electricians › Reading blueprints']],
  [0x04, null, 'community-d12a04', 'Helen', 'Park', 'Bookkeeper',
    'Keeps books for small shops and helps with grant paperwork.',
    'Portland', 'Oregon', 'United States', 8, 'Bookkeepers',
    ['Bookkeepers › Bookkeeping', 'Small Business Advisors › Grant writing']],
];

// [id, slug, invite code, handle, name, days ago published, profile id, opening, body]
const INVITES = [
  [0x20, 'demo-invite-rosa-delgado', 'dmoinvite1', 'rosa-delgado-demo', 'Rosa Delgado', 2, id(0x02),
    'Rosa, your answers about mending clothes that people thought were done for are the kind of skill this list is for.',
    'Rosa, your answers about mending clothes that people thought were done for are the kind of skill this list is for.\n\n'
      + 'You are listed in the Directory with the skills you described in your own words. The listing is yours to claim, change, or have taken down, and none of that needs an account.\n\n'
      + 'If you would like to teach a sewing basics session, members ask for that often.'],
  [0x21, 'demo-invite-daniel-brooks', 'dmoinvite2', 'daniel-brooks-demo', 'Daniel Brooks', 4, id(0x03),
    'Daniel, you explained how to check a home circuit safely better than most manuals do.',
    'Daniel, you explained how to check a home circuit safely better than most manuals do.\n\n'
      + 'You are listed in the Directory as an electrician, with the skills you wrote about. Claim the listing to change it, or ask for it to be removed.\n\n'
      + 'Members often look for someone who can say whether a repair is safe to do themselves.'],
  [0x22, 'demo-invite-helen-park', 'dmoinvite3', 'helen-park-demo', 'Helen Park', 6, id(0x04),
    'Helen, your notes on keeping simple books for a small shop were clear and practical.',
    'Helen, your notes on keeping simple books for a small shop were clear and practical.\n\n'
      + 'You are listed in the Directory with bookkeeping and grant writing. The listing is yours to claim, change, or take down.\n\n'
      + 'Several members are starting small businesses and would welcome a hand with their first year of records.'],
];

async function seedProfiles(client) {
  for (const [num, claimedBy, handle, first, last, headline, bio, city, state, country, daysAgo, mainTitle, skills] of PROFILES) {
    const title = jobTitle(mainTitle);
    await client.query(
      `INSERT INTO directory_profiles
         (id, claimed_by_user_id, unclaimed_handle, first_name, last_name, headline, bio,
          city, state, country, sector_id, job_title_id, source, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid, $12::uuid, $13,
               NOW() - make_interval(days => $14::int))
       ON CONFLICT (id) DO UPDATE SET
         claimed_by_user_id = EXCLUDED.claimed_by_user_id, unclaimed_handle = EXCLUDED.unclaimed_handle,
         first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
         headline = EXCLUDED.headline, bio = EXCLUDED.bio,
         city = EXCLUDED.city, state = EXCLUDED.state, country = EXCLUDED.country,
         sector_id = EXCLUDED.sector_id, job_title_id = EXCLUDED.job_title_id,
         source = EXCLUDED.source, updated_at = EXCLUDED.updated_at`,
      [id(num), claimedBy, handle, first, last, headline, bio, city, state, country,
        title.sectorId, title.id, claimedBy ? 'self' : 'community-generated', daysAgo],
    );
    const skillIds = skills.map(skill);
    await client.query(
      `DELETE FROM directory_profile_skills WHERE profile_id = $1::uuid AND NOT (skill_id = ANY($2::uuid[]))`,
      [id(num), skillIds],
    );
    for (const [order, skillId] of skillIds.entries()) {
      await client.query(
        `INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
         VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (profile_id, skill_id) DO UPDATE SET display_order = EXCLUDED.display_order`,
        [id(num), skillId, order],
      );
    }
  }

  await client.query(
    `INSERT INTO directory_user_extension (user_id, updated_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET service_deleted_at = NULL, updated_at = NOW()`,
    [BADGE_HOLDER],
  );
}

async function seedBadge(client) {
  await client.query(
    `INSERT INTO contributor_access_eligibility
       (user_id, eligible, first_earned_at, reason_snapshot, computed_at, revoked_for_cause, revoked_reason, revoked_at, revoked_by)
     VALUES ($1, TRUE, NOW() - INTERVAL '30 days', '{}'::jsonb, NOW(), FALSE, NULL, NULL, NULL)
     ON CONFLICT (user_id) DO UPDATE SET
       eligible = TRUE, first_earned_at = EXCLUDED.first_earned_at, computed_at = NOW(),
       revoked_for_cause = FALSE, revoked_reason = NULL, revoked_at = NULL, revoked_by = NULL`,
    [BADGE_HOLDER],
  );
}

async function seedPendingSkill(client) {
  await client.query(
    `INSERT INTO directory_profile_proposed_skills (id, profile_id, skill_label, status)
     VALUES ($1::uuid, $2::uuid, 'Bulk food buying', 'pending')
     ON CONFLICT (id) DO UPDATE SET
       profile_id = EXCLUDED.profile_id, skill_label = EXCLUDED.skill_label,
       status = 'pending', updated_at = NOW()`,
    [id(0x10), id(0x01)],
  );
}

async function seedInvites(client) {
  for (const [num, slug, code, handle, name, daysAgo, profileId, opening, body] of INVITES) {
    const quoraUrl = `https://www.quora.com/profile/${handle.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('-')}`;
    await client.query(
      `INSERT INTO directory_invites
         (id, slug, quora_handle, quora_url, name, title, opening, body_markdown, published_on,
          directory_profile_id, image, image_type, image_alt, public, blog_url, invite_code)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, (NOW() - make_interval(days => $9::int))::date,
               $10, NULL, NULL, NULL, FALSE, NULL, $11)
       ON CONFLICT (slug) DO UPDATE SET
         quora_handle = EXCLUDED.quora_handle, quora_url = EXCLUDED.quora_url, name = EXCLUDED.name,
         title = EXCLUDED.title, opening = EXCLUDED.opening, body_markdown = EXCLUDED.body_markdown,
         published_on = EXCLUDED.published_on, directory_profile_id = EXCLUDED.directory_profile_id,
         image = NULL, image_type = NULL, image_alt = NULL, public = FALSE, blog_url = NULL,
         invite_code = EXCLUDED.invite_code, updated_at = NOW()`,
      [id(num), slug, handle, quoraUrl, name, `An invitation to ${name}`, opening, body, daysAgo, profileId, code],
    );
  }
}

export default async function seed(client) {
  await seedProfiles(client);
  await seedBadge(client);
  await seedPendingSkill(client);
  await seedInvites(client);
  console.log('  ✓ demo-seed: directory (badge holder, pending skill, 3 invitations)');
}
