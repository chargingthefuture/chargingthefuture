// Workforce demo data: nine more Directory profiles whose skills sit under job titles across the
// twenty live-named sectors from 10-skills-taxonomy.mjs. Workforce reads the Directory, so this is
// what fills its occupation bars beyond Platform Engineer and puts at least one member in every
// Community Planning team (WF-10). Four are claimed by synthetic members, five are
// community-generated (unclaimed), the way most real listings are. All are dated a few days back so
// the base seed's profiles stay at the top of the Directory list.
//
// Ids: ddd00000-0000-4000-8110-0000000000XX (profiles 01-09). Synthetic members: demo-peer-workforce-NN.
import { TAXONOMY_IDS } from './10-skills-taxonomy.mjs';

const id = (n) => `ddd00000-0000-4000-8110-${n.toString(16).padStart(12, '0')}`;

// [id, claimed by (null = community-generated), handle when unclaimed, first, last, headline, bio,
//  city, state, country, days since last update, main job title, ['Job title › Skill', ...]]
const PROFILES = [
  [0x01, 'demo-peer-workforce-01', null, 'Denise', 'Walker', 'Home health aide',
    'Ten years caring for older adults at home. I also cook for our church supper.',
    'Atlanta', 'Georgia', 'United States', 2, 'Home Health Aides',
    ['Home Health Aides › Personal care assistance', 'Home Health Aides › Crisis intervention', 'Chefs and Cooks › Cooking for large groups']],
  [0x02, 'demo-peer-workforce-02', null, 'Marcus', 'Bell', 'Carpenter',
    'Framing and finish work. Lately learning solar installs.',
    'Columbus', 'Ohio', 'United States', 3, 'Carpenters',
    ['Carpenters › Framing', 'Carpenters › Reading blueprints', 'Solar Panel Installers › Solar panel installation']],
  [0x03, 'demo-peer-workforce-03', null, 'Teresa', 'Morales', 'Warehouse lead',
    'Forklift certified, and I have driven regional routes.',
    'El Paso', 'Texas', 'United States', 3, 'Warehouse Workers',
    ['Warehouse Workers › Forklift operation', 'Warehouse Workers › Inventory control', 'Truck Drivers › Commercial driving (CDL)']],
  [0x04, 'demo-peer-workforce-04', null, 'Samuel', 'Okafor', 'Computer support',
    'I fix laptops and home networks, and tutor math on weekends.',
    'Baltimore', 'Maryland', 'United States', 4, 'Computer Support Specialists',
    ['Computer Support Specialists › Help desk support', 'Computer Support Specialists › Network cabling', 'Teaching Assistants › Tutoring']],
  [0x05, null, 'community-d11a05', 'Grace', 'Lindqvist', 'Water treatment operator',
    'Runs water quality checks and keeps pumps running.',
    'Duluth', 'Minnesota', 'United States', 4, 'Water Treatment Plant Operators',
    ['Water Treatment Plant Operators › Water quality testing', 'Water Treatment Plant Operators › Pump maintenance', 'Lab Technicians › Laboratory testing (basic)', 'Research Assistants › Data collection']],
  [0x06, null, 'community-d11a06', 'Paul', 'Novak', 'Welder',
    'MIG welding and small metal fabrication; has run heavy equipment.',
    'Scranton', 'Pennsylvania', 'United States', 5, 'Welders',
    ['Welders › MIG welding', 'Welders › Metal fabrication', 'Quarry Workers › Heavy equipment operation']],
  [0x07, null, 'community-d11a07', 'Ruth', 'Adams', 'Office manager',
    'Keeps the books and the calendar for a small nonprofit.',
    'Tucson', 'Arizona', 'United States', 5, 'Bookkeepers',
    ['Bookkeepers › Bookkeeping', 'Administrative Assistants › Scheduling', 'Paralegals › Legal research']],
  [0x08, null, 'community-d11a08', 'Henry', 'Castillo', 'Grower',
    'Grows vegetables on a shared plot and runs the compost.',
    'Fresno', 'California', 'United States', 6, 'Farmworkers',
    ['Farmworkers › Crop planting', 'Farmworkers › Harvesting', 'Recycling Coordinators › Composting']],
  [0x09, null, 'community-d11a09', 'Linda', 'Price', 'Childcare provider',
    'Home childcare provider. Edits the neighborhood newsletter and takes its photos.',
    'Richmond', 'Virginia', 'United States', 6, 'Childcare Workers',
    ['Childcare Workers › Childcare', 'Writers and Editors › Editing', 'Photographers › Photography', 'Emergency Responders › First aid and CPR']],
];

function requireTaxonomy(map, key, what) {
  const value = map[key];
  if (!value) {
    throw new Error(`11-workforce: ${what} "${key}" is not in 10-skills-taxonomy.mjs; add it there or fix the name here.`);
  }
  return value;
}

export default async function seed(client) {
  for (const [num, claimedBy, handle, first, last, headline, bio, city, state, country, daysAgo, mainTitle, skills] of PROFILES) {
    const jobTitle = requireTaxonomy(TAXONOMY_IDS.jobTitles, mainTitle, 'job title');
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
        jobTitle.sectorId, jobTitle.id, claimedBy ? 'self' : 'community-generated', daysAgo],
    );

    // The profile's skills are exactly this list on every run.
    const skillIds = skills.map((key) => requireTaxonomy(TAXONOMY_IDS.skills, key, 'skill'));
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

    if (claimedBy) {
      await client.query(
        `INSERT INTO directory_user_extension (user_id, updated_at)
         VALUES ($1, NOW())
         ON CONFLICT (user_id) DO UPDATE SET service_deleted_at = NULL, updated_at = NOW()`,
        [claimedBy],
      );
    }
  }
  console.log('  ✓ demo-seed: workforce (9 Directory profiles with skills across 13 teams)');
}
