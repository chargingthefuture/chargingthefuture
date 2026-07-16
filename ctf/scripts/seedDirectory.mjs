#!/usr/bin/env node

import { Pool } from 'pg';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const pool = new Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});

// directory_profiles.id is UUID, so the deterministic seed ids must be valid
// UUIDs. userId stays a free-form text key for directory_user_extension.
const seedUsers = [
  {
    profileId: 'd1100000-0000-4000-8000-000000000001',
    userId: 'seed-directory-user-001',
    firstName: 'Amina',
    lastName: 'Johnson',
    headline: 'Community support navigator',
    bio: 'Deterministic seed profile for directory phase-0 validation.',
    // Country is required on every active directory profile (see the
    // directory_profiles_active_country_present constraint in schema.sql); two countries so the seed
    // exercises the GDP "All Countries" member-by-country breakdown, not a single-row panel.
    country: 'United States',
  },
  {
    profileId: 'd1100000-0000-4000-8000-000000000002',
    userId: 'seed-directory-user-002',
    firstName: 'Luis',
    lastName: 'Rivera',
    headline: 'Legal advocacy coordinator',
    bio: 'Second deterministic profile for pagination and claimed-state checks.',
    country: 'Mexico',
  },
];

async function firstSelectorIds(client) {
  const sector = await client.query('SELECT id FROM skills_taxonomy_sectors WHERE is_active = true ORDER BY display_order ASC, name ASC LIMIT 1');
  const jobTitle = await client.query('SELECT id FROM skills_taxonomy_job_titles WHERE is_active = true ORDER BY display_order ASC, name ASC LIMIT 1');
  const skills = await client.query('SELECT id FROM skills_taxonomy_skills WHERE is_active = true ORDER BY display_order ASC, name ASC LIMIT 2');

  return {
    sectorId: sector.rows[0]?.id ?? null,
    jobTitleId: jobTitle.rows[0]?.id ?? null,
    skillIds: skills.rows.map((row) => row.id),
  };
}

async function hasColumn(client, tableName, columnName) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return result.rows.length > 0;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const selectors = await firstSelectorIds(client);

    for (const user of seedUsers) {
      const existingProfile = await client.query(
        `
          SELECT id
          FROM directory_profiles
          WHERE id = $1::uuid
          LIMIT 1
        `,
        [user.profileId],
      );

      let profileResult;
      if (existingProfile.rows.length > 0) {
        profileResult = await client.query(
          `
            UPDATE directory_profiles
            SET
              claimed_by_user_id = NULL,
              first_name = $2,
              last_name = $3,
              headline = $4,
              bio = $5,
              profile_url = NULL,
              source = 'admin',
              sector_id = $6::uuid,
              job_title_id = $7::uuid,
              country = $8::text,
              is_active = true,
              deleted_at = NULL,
              updated_at = NOW()
            WHERE id = $1::uuid
            RETURNING id
          `,
          [
            existingProfile.rows[0].id,
            user.firstName,
            user.lastName,
            user.headline,
            user.bio,
            selectors.sectorId,
            selectors.jobTitleId,
            user.country,
          ],
        );
      } else {
        profileResult = await client.query(
          `
            INSERT INTO directory_profiles
              (id, claimed_by_user_id, first_name, last_name, headline, bio, profile_url, source, sector_id, job_title_id, country, is_active)
            VALUES
              ($1::uuid, NULL, $2::text, $3::text, $4::text, $5::text, NULL, 'admin', $6::uuid, $7::uuid, $8::text, true)
            RETURNING id
          `,
          [
            user.profileId,
            user.firstName,
            user.lastName,
            user.headline,
            user.bio,
            selectors.sectorId,
            selectors.jobTitleId,
            user.country,
          ],
        );
      }

      const profileId = profileResult.rows[0].id;

      await client.query('DELETE FROM directory_profile_skills WHERE profile_id = $1', [profileId]);

      for (let index = 0; index < selectors.skillIds.length; index += 1) {
        await client.query(
          `
            INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
            VALUES ($1, $2::uuid, $3)
            ON CONFLICT (profile_id, skill_id)
            DO UPDATE SET display_order = EXCLUDED.display_order
          `,
          [profileId, selectors.skillIds[index], index + 1],
        );
      }

      await client.query(
        `
          INSERT INTO directory_user_extension (user_id, profile_visibility, service_deleted_at, updated_at)
          VALUES ($1, 'workspace', NULL, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            profile_visibility = EXCLUDED.profile_visibility,
            service_deleted_at = NULL,
            updated_at = NOW()
        `,
        [user.userId],
      );
    }

    const announcementBody = 'Directory phase-0 deterministic fixtures are active for validation.';
    if (await hasColumn(client, 'directory_announcements', 'content')) {
      await client.query(
        `
          INSERT INTO directory_announcements
            (title, body, content, is_active, published_at, expires_at, created_by_user_id, updated_by_user_id)
          VALUES
            ('Directory seed announcement',
             $1,
             $1,
             true,
             NOW(),
             NULL,
             'seed-admin',
             'seed-admin')
          ON CONFLICT DO NOTHING
        `,
        [announcementBody],
      );
    } else {
      await client.query(
        `
          INSERT INTO directory_announcements
            (title, body, is_active, published_at, expires_at, created_by_user_id, updated_by_user_id)
          VALUES
            ('Directory seed announcement',
             $1,
             true,
             NOW(),
             NULL,
             'seed-admin',
             'seed-admin')
          ON CONFLICT DO NOTHING
        `,
        [announcementBody],
      );
    }

    await client.query('COMMIT');
    console.log('Directory phase-0 seed fixtures applied.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
