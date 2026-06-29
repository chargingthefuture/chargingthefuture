// DEPRECATED — legacy is gone; the LIVE taxonomy is the source of truth.
//
// This module backfilled the canonical taxonomy from the old platform dataset at
// `platform/scripts/data/skills-data.ts`. That legacy app has been removed, so the dataset file no
// longer exists and this sync is no longer the source of taxonomy data. The authoritative skills
// taxonomy now lives ONLY in the live database (`skills_taxonomy_sectors` / `_job_titles` / `_skills`).
//
// To ADD a skill (e.g. promoting a SkillsHunt proposal), do NOT look for or re-create the legacy
// dataset — append an entry to the curated promotions list in `seedSkillsTaxonomyPromotions.mjs` (it
// looks the sector up by name in the live DB and upserts the occupation/skill) and run that seed.
// Treat the live DB taxonomy as canonical; do not relitigate the legacy path.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadLegacySkillsData, normalizeTaxonomyName } from './loadLegacySkillsData.mjs';

const TARGET_CONSUMER_BINDING = 'legacy-platform-skills-data';

function parseOptions(mode) {
  const validModes = new Set(['backfill', 'sync']);
  if (!validModes.has(mode)) {
    throw new Error(`Unsupported mode "${mode}". Use "backfill" or "sync".`);
  }

  return { mode };
}

function repoRootFromScript() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '../../..');
}

function defaultLegacyFilePath() {
  return path.resolve(repoRootFromScript(), 'platform/scripts/data/skills-data.ts');
}

async function upsertSector(client, sector) {
  const result = await client.query(
    `
      INSERT INTO skills_taxonomy_sectors (name, display_order, workforce_share, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT ((lower(name)))
      DO UPDATE SET
        display_order = EXCLUDED.display_order,
        workforce_share = EXCLUDED.workforce_share,
        is_active = true,
        updated_at = NOW()
      RETURNING id
    `,
    [sector.name, sector.displayOrder, sector.workforceShare],
  );

  return result.rows[0].id;
}

async function upsertJobTitle(client, sectorId, jobTitle) {
  const result = await client.query(
    `
      INSERT INTO skills_taxonomy_job_titles (sector_id, name, display_order, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (sector_id, (lower(name)))
      DO UPDATE SET
        display_order = EXCLUDED.display_order,
        is_active = true,
        updated_at = NOW()
      RETURNING id
    `,
    [sectorId, jobTitle.name, jobTitle.displayOrder],
  );

  return result.rows[0].id;
}

async function upsertSkill(client, jobTitleId, skillName, displayOrder) {
  const result = await client.query(
    `
      INSERT INTO skills_taxonomy_skills (job_title_id, name, display_order, aliases, is_active)
      VALUES ($1, $2, $3, '[]'::jsonb, true)
      ON CONFLICT (job_title_id, (lower(name)))
      DO UPDATE SET
        display_order = EXCLUDED.display_order,
        is_active = true,
        updated_at = NOW()
      RETURNING id
    `,
    [jobTitleId, skillName, displayOrder],
  );

  return result.rows[0].id;
}

async function upsertLegacyBinding(client, skillId) {
  await client.query(
    `
      INSERT INTO skills_taxonomy_consumer_bindings
        (consumer_name, target_type, target_id, reference_count, metadata)
      VALUES
        ($1, 'skill', $2::uuid, 1, '{"source":"legacy-platform","kind":"sync"}'::jsonb)
      ON CONFLICT (consumer_name, target_type, target_id)
      DO UPDATE SET
        reference_count = EXCLUDED.reference_count,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
    [TARGET_CONSUMER_BINDING, skillId],
  );
}

async function deactivateMissing(client, tableName, touchedIds) {
  await client.query(
    `
      UPDATE ${tableName}
      SET is_active = false, updated_at = NOW()
      WHERE NOT (id = ANY($1::uuid[]))
    `,
    [touchedIds],
  );
}

export async function syncSkillsTaxonomyFromLegacy({ pool, mode = 'sync', legacyFilePath } = {}) {
  if (!pool) {
    throw new Error('pool is required.');
  }

  const options = parseOptions(mode);
  const dataPath = legacyFilePath ?? defaultLegacyFilePath();
  const legacyData = await loadLegacySkillsData(dataPath);

  const touchedSectorIds = [];
  const touchedJobTitleIds = [];
  const touchedSkillIds = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const sectorEntry of legacyData) {
      const sector = {
        name: normalizeTaxonomyName(sectorEntry.sector.name),
        displayOrder: sectorEntry.sector.displayOrder,
        workforceShare: sectorEntry.sector.workforceShare,
      };

      if (sector.name.length === 0) {
        continue;
      }

      const sectorId = await upsertSector(client, sector);
      touchedSectorIds.push(sectorId);

      for (const jobTitleEntry of sectorEntry.jobTitles) {
        const jobTitleName = normalizeTaxonomyName(jobTitleEntry.name);
        if (jobTitleName.length === 0) {
          continue;
        }

        const jobTitleId = await upsertJobTitle(client, sectorId, {
          name: jobTitleName,
          displayOrder: jobTitleEntry.displayOrder,
        });
        touchedJobTitleIds.push(jobTitleId);

        for (let index = 0; index < jobTitleEntry.skills.length; index += 1) {
          const skillName = normalizeTaxonomyName(jobTitleEntry.skills[index]);
          if (skillName.length === 0) {
            continue;
          }

          const skillId = await upsertSkill(client, jobTitleId, skillName, index + 1);
          touchedSkillIds.push(skillId);
          await upsertLegacyBinding(client, skillId);
        }
      }
    }

    await deactivateMissing(client, 'skills_taxonomy_skills', touchedSkillIds);
    await deactivateMissing(client, 'skills_taxonomy_job_titles', touchedJobTitleIds);
    await deactivateMissing(client, 'skills_taxonomy_sectors', touchedSectorIds);

    await client.query(
      `
        DELETE FROM skills_taxonomy_consumer_bindings
        WHERE consumer_name = $1
          AND target_type = 'skill'
          AND NOT (target_id = ANY($2::uuid[]))
      `,
      [TARGET_CONSUMER_BINDING, touchedSkillIds],
    );

    await client.query(
      `
        INSERT INTO skills_taxonomy_change_events
          (actor_id, target_type, target_id, action, reason, metadata, created_at)
        VALUES
          ('system:legacy-sync', 'sector', 'legacy-platform-skills-data', 'preview', $1::text,
           jsonb_build_object(
             'mode', $2::text,
             'sourceFile', $3::text,
             'sectorCount', $4::integer,
             'jobTitleCount', $5::integer,
             'skillCount', $6::integer
           ), NOW())
      `,
      [
        'Legacy platform skills taxonomy synchronization completed.',
        options.mode,
        dataPath,
        touchedSectorIds.length,
        touchedJobTitleIds.length,
        touchedSkillIds.length,
      ],
    );

    await client.query('COMMIT');

    return {
      mode: options.mode,
      sourceFile: dataPath,
      sectors: touchedSectorIds.length,
      jobTitles: touchedJobTitleIds.length,
      skills: touchedSkillIds.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
