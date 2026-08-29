// Applies the append-only taxonomy change list (taxonomyChange.mjs) to the LIVE database.
// This is the ONLY code path that writes the skills taxonomy from the repo — run by
// seedSkillsTaxonomy.mjs via the owner-run workflow (.github/workflows/seed-skills-taxonomy.yml).
//
// Design (owner decisions 2026-07-03 — see ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md):
// - Replays the whole list in one transaction, in order. Every change is NATURALLY IDEMPOTENT: an entry
//   whose end state already holds writes nothing, so re-running the full list is always safe and a
//   reseed can never resurrect a deactivated row (deactivation is itself an entry in the list).
// - NO HARD DELETE. Deactivate/reactivate flip is_active; reparent moves a skill row's
//   job_title_id (member profile links reference the skill row id, so members keep their skills).
// - Sectors are looked up by name, never created. A missing sector is recorded in the summary and
//   the changes that need it are skipped; the run then exits non-zero so the skip is visible.
// - Every real mutation writes a skills_taxonomy_change_events audit row (actor
//   'taxonomy-change', metadata carries the change id). No-ops write nothing.
// - Deactivations re-check the live member-reference count; the validation layer already requires
//   an acknowledgedImpact note on the entry, and the live count is recorded in the audit metadata.
// - addSkill carries the skill-proposal side-effects: matching skills_hunt_proposed_skill_promotions
//   rows are marked 'promoted', and the now-official skill is auto-attached to every profile that was
//   waiting on it — self-edit Directory "skill not listed" proposals AND nominated / community-generated
//   profiles whose SkillsHunt nomination proposed the skill.

import { normalizeTaxonomyName, isPluralTwin } from './taxonomyNames.mjs';
import { TAXONOMY_CHANGES, validateTaxonomyChanges } from './taxonomyChange.mjs';

const ACTOR_ID = 'taxonomy-change';

// The plural-twin guard (see the addOccupation case) applies to changes appended from this id on.
// Everything below it replays exactly as it did before the guard existed, and that is deliberate:
// change 1 IS the "Marketing Specialist" twin, the mistake this guard exists to prevent. The list
// then cleans it up in changes 26-34. Guarding change 1 would make the change list unable to replay
// itself into a fresh database - the run would abort on the historical entry that records the very
// problem, and no later cleanup would ever get the chance to run. Production never sees this
// (the row exists there, so the change no-ops before reaching the guard), which is exactly the kind
// of difference that would go unnoticed until somebody rebuilt an environment from scratch.
// Every addOccupation entry between 2 and 79 was checked against the live occupation list and none
// names a twin, so the boundary costs no coverage on anything still to apply.
const PLURAL_TWIN_GUARD_FIRST_CHANGE_ID = 80;

// The guard's decision, kept separate from the database call so it can be exercised directly:
// given the change's id, the occupation it wants to create, and the sector's live rows, which of
// those rows name the same role? Empty means the add may proceed.
export function findPluralTwins(changeId, occupationName, liveRows) {
  if (!Number.isInteger(changeId) || changeId < PLURAL_TWIN_GUARD_FIRST_CHANGE_ID) return [];
  return (liveRows ?? []).filter((row) => isPluralTwin(occupationName, row.name));
}

async function findSectorIdByName(client, sectorName) {
  const result = await client.query(
    `SELECT id FROM skills_taxonomy_sectors WHERE lower(name) = lower($1) LIMIT 1`,
    [sectorName],
  );
  return result.rows[0]?.id ?? null;
}

// Every occupation name live in a sector, active or not. Used by the plural-twin guard, which has
// to see deactivated rows too: creating a twin of a row somebody deliberately turned off is the same
// split, and would quietly resurrect the problem the deactivation was cleaning up.
async function listJobTitleNames(client, sectorId) {
  const result = await client.query(
    `SELECT name, is_active FROM skills_taxonomy_job_titles WHERE sector_id = $1`,
    [sectorId],
  );
  return result.rows;
}

async function findJobTitle(client, sectorId, name) {
  const result = await client.query(
    `SELECT id, is_active FROM skills_taxonomy_job_titles
      WHERE sector_id = $1 AND lower(name) = lower($2) LIMIT 1`,
    [sectorId, name],
  );
  return result.rows[0] ?? null;
}

async function findSkill(client, jobTitleId, name) {
  const result = await client.query(
    `SELECT id, is_active, aliases FROM skills_taxonomy_skills
      WHERE job_title_id = $1 AND lower(name) = lower($2) LIMIT 1`,
    [jobTitleId, name],
  );
  return result.rows[0] ?? null;
}

async function countSkillMemberReferences(client, skillId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total FROM directory_profile_skills WHERE skill_id = $1`,
    [skillId],
  );
  return result.rows[0]?.total ?? 0;
}

async function recordChangeEvent(client, { targetType, targetId, action, reason, metadata }) {
  await client.query(
    `INSERT INTO skills_taxonomy_change_events (actor_id, target_type, target_id, action, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [ACTOR_ID, targetType, targetId, action, reason, JSON.stringify(metadata ?? {})],
  );
}

// Skill-proposal side-effects of addSkill: mark the cross-app proposal tracker rows 'promoted' and
// attach the now-official skill to every profile that was waiting on it — both self-edit Directory
// "skill not listed" proposals AND nominated / community-generated profiles whose SkillsHunt nomination
// proposed the skill — then mark the Directory proposals promoted. Idempotent.
async function applyProposalPromotions(client, jobTitleId, normalizedSkills, summary) {
  if (!Array.isArray(normalizedSkills) || normalizedSkills.length === 0) {
    return;
  }
  const labels = normalizedSkills.map((value) => value.trim().toLowerCase());

  const marked = await client.query(
    `UPDATE skills_hunt_proposed_skill_promotions
        SET status = 'promoted', updated_at = NOW()
      WHERE lower(btrim(normalized_skill)) = ANY($1::text[])
        AND status <> 'promoted'`,
    [labels],
  );
  summary.proposalsMarkedPromoted += marked.rowCount ?? 0;

  const attached = await client.query(
    `INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
     SELECT
       d.profile_id,
       sk.id,
       COALESCE(
         (SELECT MAX(x.display_order) FROM directory_profile_skills x WHERE x.profile_id = d.profile_id),
         0
       ) + 1
     FROM directory_profile_proposed_skills d
     JOIN skills_taxonomy_skills sk
       ON sk.job_title_id = $1
      AND lower(btrim(sk.name)) = lower(btrim(d.skill_label))
      AND sk.is_active = true
     WHERE d.status = 'pending'
       AND lower(btrim(d.skill_label)) = ANY($2::text[])
     ON CONFLICT (profile_id, skill_id) DO NOTHING`,
    [jobTitleId, labels],
  );
  summary.directorySkillsAutoAttached += attached.rowCount ?? 0;

  // Nominated / community-generated profiles surface a proposed skill through
  // skills_hunt_directory_profiles -> the cross-app tracker (loadProfilePendingSkills), NOT through
  // directory_profile_proposed_skills. Attach the now-official skill to those profiles too, or the
  // "pending review" chip would just vanish when the tracker flips to 'promoted' above. This does not
  // depend on the tracker status (it may already be 'promoted'), so re-applying repairs any nominated
  // profile that lost the skill before this branch existed. directory_profile_id is TEXT (v2
  // varchar/uuid), so only cast rows that are UUID-shaped — a malformed id can never abort the run.
  const attachedNominated = await client.query(
    `INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
     SELECT
       shdp.directory_profile_id::uuid,
       sk.id,
       COALESCE(
         (SELECT MAX(x.display_order) FROM directory_profile_skills x
           WHERE x.profile_id = shdp.directory_profile_id::uuid),
         0
       ) + 1
     FROM skills_hunt_directory_profiles shdp
     JOIN skills_hunt_proposed_skill_promotions prom
       ON prom.source_submission_id = shdp.submission_id
     JOIN skills_taxonomy_skills sk
       ON sk.job_title_id = $1
      AND lower(btrim(sk.name)) = lower(btrim(prom.skill_label))
      AND sk.is_active = true
     WHERE lower(btrim(prom.normalized_skill)) = ANY($2::text[])
       AND shdp.directory_profile_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     ON CONFLICT (profile_id, skill_id) DO NOTHING`,
    [jobTitleId, labels],
  );
  summary.directorySkillsAutoAttached += attachedNominated.rowCount ?? 0;

  const markedDirectory = await client.query(
    `UPDATE directory_profile_proposed_skills
        SET status = 'promoted', updated_at = NOW()
      WHERE status <> 'promoted'
        AND lower(btrim(skill_label)) = ANY($1::text[])`,
    [labels],
  );
  summary.directoryProposalsMarkedPromoted += markedDirectory.rowCount ?? 0;
}

// Resolve the occupation an entry targets. Returns { id } or null (missing sector/occupation is
// recorded on the summary and the entry is skipped — never invented).
async function resolveOccupation(client, sectorName, occupationName, summary, opId) {
  const sector = normalizeTaxonomyName(sectorName);
  const occupation = normalizeTaxonomyName(occupationName);
  const sectorId = await findSectorIdByName(client, sector);
  if (!sectorId) {
    summary.missingSectors.push(`${sector} (change ${opId})`);
    return null;
  }
  const jobTitle = await findJobTitle(client, sectorId, occupation);
  if (!jobTitle) {
    summary.missingTargets.push(`occupation "${occupation}" in ${sector} (change ${opId})`);
    return null;
  }
  return jobTitle;
}

export async function applyTaxonomyChanges({ pool, changes = TAXONOMY_CHANGES } = {}) {
  if (!pool) {
    throw new Error('pool is required.');
  }

  const validation = validateTaxonomyChanges(changes);
  if (!validation.valid) {
    throw new Error(`taxonomy change list is invalid:\n${validation.errors.join('\n')}`);
  }

  const summary = {
    applied: 0,
    noops: 0,
    occupationsCreated: 0,
    skillsCreated: 0,
    renames: 0,
    reparents: 0,
    deactivations: 0,
    reactivations: 0,
    proposalsMarkedPromoted: 0,
    directoryProposalsMarkedPromoted: 0,
    directorySkillsAutoAttached: 0,
    missingSectors: [],
    missingTargets: [],
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Pre-flight: check every reparentSkill entry against the live state and report ALL collisions in
    // one error, with the blocking row's active state and both rows' member-holder counts. Without
    // this the run dies on the first collision of possibly several, costing one run per
    // discovery. Purely read-only; the in-loop check stays as the authoritative sequential guard.
    const collisions = [];
    for (const op of changes) {
      if (op.op !== 'reparentSkill') continue;
      const toSectorId = await findSectorIdByName(client, normalizeTaxonomyName(op.toSector));
      if (!toSectorId) continue;
      const toTitle = await findJobTitle(client, toSectorId, normalizeTaxonomyName(op.toOccupation));
      if (!toTitle) continue;
      const atTarget = await findSkill(client, toTitle.id, normalizeTaxonomyName(op.skill));
      if (!atTarget) continue;
      const fromSectorId = await findSectorIdByName(client, normalizeTaxonomyName(op.fromSector));
      const fromTitle = fromSectorId
        ? await findJobTitle(client, fromSectorId, normalizeTaxonomyName(op.fromOccupation))
        : null;
      const atSource = fromTitle ? await findSkill(client, fromTitle.id, normalizeTaxonomyName(op.skill)) : null;
      if (!atSource) continue; // no source row -> the in-loop handler treats it as already reparented
      const targetHolders = await countSkillMemberReferences(client, atTarget.id);
      const sourceHolders = await countSkillMemberReferences(client, atSource.id);
      collisions.push(
        `change ${op.id}: "${op.skill}" already exists under "${op.toOccupation}" `
        + `(target row ${atTarget.is_active ? 'ACTIVE' : 'INACTIVE'}, ${targetHolders} member holder(s); `
        + `source row under "${op.fromOccupation}" has ${sourceHolders} member holder(s)). `
        + `A reparent cannot merge rows — correct this never-applied entry (e.g. deactivate the source `
        + `copy and, if the target row is inactive, reactivate it).`,
      );
    }
    if (collisions.length > 0) {
      throw new Error(`reparent collision pre-flight found ${collisions.length} conflict(s):\n${collisions.join('\n')}`);
    }

    for (const op of changes) {
      const meta = { opId: op.id, op: op.op };

      switch (op.op) {
        case 'addOccupation': {
          const sector = normalizeTaxonomyName(op.sector);
          const occupation = normalizeTaxonomyName(op.occupation);
          const sectorId = await findSectorIdByName(client, sector);
          if (!sectorId) {
            summary.missingSectors.push(`${sector} (change ${op.id})`);
            break;
          }
          const existing = await findJobTitle(client, sectorId, occupation);
          if (existing && existing.is_active) {
            summary.noops += 1;
            break;
          }
          if (existing) {
            // Exists but inactive: an addOccupation change does NOT resurrect it — that would let a
            // reseed undo a deactivation. Reactivation is its own explicit change.
            summary.noops += 1;
            break;
          }
          // Plural-twin guard. The taxonomy has twice grown a singular occupation beside a live
          // plural one - "Marketing Specialist" beside "Marketing Specialists", and "Photographer"
          // beside "Photographers / Videographers" - and each split one role's holders across two
          // rows that neither Workforce nor the Directory joins back together. The change list's
          // static check cannot see this: the live rows are in the database, not the repo. Here they
          // are visible, so refuse rather than create the second row. Failing the whole run is the
          // point - the transaction rolls back, nothing partial lands, and the change is corrected
          // in a PR instead of being cleaned up afterwards across nine more changes.
          // The id check is repeated here only to skip the extra query for changes the guard does
          // not apply to; findPluralTwins enforces the boundary itself.
          const twins =
            op.id >= PLURAL_TWIN_GUARD_FIRST_CHANGE_ID
              ? findPluralTwins(op.id, occupation, await listJobTitleNames(client, sectorId))
              : [];
          if (twins.length > 0) {
            const listed = twins
              .map((row) => `"${row.name}"${row.is_active ? '' : ' (deactivated)'}`)
              .join(', ');
            throw new Error(
              `change ${op.id}: addOccupation "${occupation}" would sit in ${sector} alongside ${listed}, ` +
                'which names the same role. Two rows for one role split its holders in half and neither ' +
                'shows the real capacity. If the live row is the one you mean, drop this addOccupation and ' +
                'use addSkill with occupationExisting: true against that name. If the live row is genuinely ' +
                'a different role, rename one of them so the difference is legible before adding.',
            );
          }
          const inserted = await client.query(
            `INSERT INTO skills_taxonomy_job_titles (sector_id, name, display_order, is_active)
             VALUES ($1, $2, 0, true) RETURNING id`,
            [sectorId, occupation],
          );
          await recordChangeEvent(client, {
            targetType: 'job-title', targetId: inserted.rows[0].id, action: 'create',
            reason: `change ${op.id}: addOccupation`, metadata: meta,
          });
          summary.occupationsCreated += 1;
          summary.applied += 1;
          break;
        }

        case 'addSkill': {
          const jobTitle = await resolveOccupation(client, op.sector, op.occupation, summary, op.id);
          if (!jobTitle) break;
          const skillName = normalizeTaxonomyName(op.skill);
          const existing = await findSkill(client, jobTitle.id, skillName);
          if (existing) {
            // Present (active or deliberately deactivated) — nothing to write; reactivation is its own change.
            summary.noops += 1;
            // The promotion side-effects still run: they are themselves idempotent and a
            // previously-applied addSkill may have new pending Directory proposals to resolve.
            await applyProposalPromotions(client, jobTitle.id, op.proposalNormalizedSkills, summary);
            break;
          }
          const inserted = await client.query(
            `INSERT INTO skills_taxonomy_skills (job_title_id, name, display_order, aliases, is_active)
             VALUES ($1, $2, 0, '[]'::jsonb, true) RETURNING id`,
            [jobTitle.id, skillName],
          );
          await recordChangeEvent(client, {
            targetType: 'skill', targetId: inserted.rows[0].id, action: 'create',
            reason: `change ${op.id}: addSkill`, metadata: meta,
          });
          summary.skillsCreated += 1;
          summary.applied += 1;
          await applyProposalPromotions(client, jobTitle.id, op.proposalNormalizedSkills, summary);
          break;
        }

        case 'renameOccupation': {
          const sector = normalizeTaxonomyName(op.sector);
          const sectorId = await findSectorIdByName(client, sector);
          if (!sectorId) {
            summary.missingSectors.push(`${sector} (change ${op.id})`);
            break;
          }
          const from = await findJobTitle(client, sectorId, normalizeTaxonomyName(op.from));
          const to = await findJobTitle(client, sectorId, normalizeTaxonomyName(op.to));
          if (!from && to) {
            summary.noops += 1; // already renamed
            break;
          }
          if (!from) {
            summary.missingTargets.push(`occupation "${op.from}" in ${sector} (change ${op.id})`);
            break;
          }
          if (to) {
            throw new Error(`change ${op.id}: rename target "${op.to}" already exists in ${sector} alongside "${op.from}" — resolve manually.`);
          }
          await client.query(
            `UPDATE skills_taxonomy_job_titles SET name = $2, updated_at = NOW() WHERE id = $1`,
            [from.id, normalizeTaxonomyName(op.to)],
          );
          await recordChangeEvent(client, {
            targetType: 'job-title', targetId: from.id, action: 'rename',
            reason: `change ${op.id}: renameOccupation "${op.from}" -> "${op.to}"`, metadata: meta,
          });
          summary.renames += 1;
          summary.applied += 1;
          break;
        }

        case 'renameSkill': {
          const jobTitle = await resolveOccupation(client, op.sector, op.occupation, summary, op.id);
          if (!jobTitle) break;
          const from = await findSkill(client, jobTitle.id, normalizeTaxonomyName(op.from));
          const to = await findSkill(client, jobTitle.id, normalizeTaxonomyName(op.to));
          if (!from && to) {
            summary.noops += 1; // already renamed
            break;
          }
          if (!from) {
            summary.missingTargets.push(`skill "${op.from}" under "${op.occupation}" (change ${op.id})`);
            break;
          }
          if (to) {
            throw new Error(`change ${op.id}: rename target skill "${op.to}" already exists under "${op.occupation}" — resolve manually.`);
          }
          // Keep the old label findable: append it to aliases if absent.
          const aliases = Array.isArray(from.aliases) ? from.aliases : [];
          const oldLabel = normalizeTaxonomyName(op.from);
          const nextAliases = aliases.some((a) => String(a).toLowerCase() === oldLabel.toLowerCase())
            ? aliases
            : [...aliases, oldLabel];
          await client.query(
            `UPDATE skills_taxonomy_skills SET name = $2, aliases = $3::jsonb, updated_at = NOW() WHERE id = $1`,
            [from.id, normalizeTaxonomyName(op.to), JSON.stringify(nextAliases)],
          );
          await recordChangeEvent(client, {
            targetType: 'skill', targetId: from.id, action: 'rename',
            reason: `change ${op.id}: renameSkill "${op.from}" -> "${op.to}"`, metadata: meta,
          });
          summary.renames += 1;
          summary.applied += 1;
          break;
        }

        case 'reparentSkill': {
          const fromTitle = await resolveOccupation(client, op.fromSector, op.fromOccupation, summary, op.id);
          const toTitle = await resolveOccupation(client, op.toSector, op.toOccupation, summary, op.id);
          if (!toTitle) break;
          const skillName = normalizeTaxonomyName(op.skill);
          const atTarget = await findSkill(client, toTitle.id, skillName);
          const atSource = fromTitle ? await findSkill(client, fromTitle.id, skillName) : null;
          if (!atSource && atTarget) {
            summary.noops += 1; // already reparented
            break;
          }
          if (!atSource) {
            summary.missingTargets.push(`skill "${op.skill}" under "${op.fromOccupation}" (change ${op.id})`);
            break;
          }
          if (atTarget) {
            throw new Error(`change ${op.id}: a skill named "${op.skill}" already exists under "${op.toOccupation}" — a reparent cannot merge rows; resolve manually.`);
          }
          const memberReferences = await countSkillMemberReferences(client, atSource.id);
          await client.query(
            `UPDATE skills_taxonomy_skills SET job_title_id = $2, updated_at = NOW() WHERE id = $1`,
            [atSource.id, toTitle.id],
          );
          await recordChangeEvent(client, {
            targetType: 'skill', targetId: atSource.id, action: 'reparent',
            reason: `change ${op.id}: reparentSkill "${op.skill}" "${op.fromOccupation}" -> "${op.toOccupation}"`,
            metadata: { ...meta, fromJobTitleId: fromTitle?.id ?? null, toJobTitleId: toTitle.id, memberReferences },
          });
          summary.reparents += 1;
          summary.applied += 1;
          break;
        }

        case 'consolidateSkill': {
          const fromTitle = await resolveOccupation(client, op.fromSector, op.fromOccupation, summary, op.id);
          const toTitle = await resolveOccupation(client, op.toSector, op.toOccupation, summary, op.id);
          if (!toTitle) break;
          const skillName = normalizeTaxonomyName(op.skill);
          const atTarget = await findSkill(client, toTitle.id, skillName);
          const atSource = fromTitle ? await findSkill(client, fromTitle.id, skillName) : null;
          if (!atSource && !atTarget) {
            summary.missingTargets.push(`skill "${op.skill}" under "${op.fromOccupation}" or "${op.toOccupation}" (change ${op.id})`);
            break;
          }
          if (!atSource && atTarget) {
            // Already consolidated; make sure the surviving row is active.
            if (atTarget.is_active) {
              summary.noops += 1;
              break;
            }
            await client.query(
              `UPDATE skills_taxonomy_skills SET is_active = true, updated_at = NOW() WHERE id = $1`,
              [atTarget.id],
            );
            await recordChangeEvent(client, {
              targetType: 'skill', targetId: atTarget.id, action: 'reactivate',
              reason: `change ${op.id}: consolidateSkill "${op.skill}" — surviving row under "${op.toOccupation}" reactivated`,
              metadata: meta,
            });
            summary.reactivations += 1;
            summary.applied += 1;
            break;
          }
          if (atSource && !atTarget) {
            // No collision: plain reparent.
            const memberReferences = await countSkillMemberReferences(client, atSource.id);
            await client.query(
              `UPDATE skills_taxonomy_skills SET job_title_id = $2, updated_at = NOW() WHERE id = $1`,
              [atSource.id, toTitle.id],
            );
            await recordChangeEvent(client, {
              targetType: 'skill', targetId: atSource.id, action: 'reparent',
              reason: `change ${op.id}: consolidateSkill "${op.skill}" "${op.fromOccupation}" -> "${op.toOccupation}"`,
              metadata: { ...meta, fromJobTitleId: fromTitle?.id ?? null, toJobTitleId: toTitle.id, memberReferences },
            });
            summary.reparents += 1;
            summary.applied += 1;
            break;
          }
          // Both exist: the target row survives, the source copy is absorbed (deactivated).
          let consolidated = false;
          if (atSource.is_active) {
            const sourceHolders = await countSkillMemberReferences(client, atSource.id);
            await client.query(
              `UPDATE skills_taxonomy_skills SET is_active = false, updated_at = NOW() WHERE id = $1`,
              [atSource.id],
            );
            await recordChangeEvent(client, {
              targetType: 'skill', targetId: atSource.id, action: 'deactivate',
              reason: `change ${op.id}: consolidateSkill "${op.skill}" — source copy under "${op.fromOccupation}" absorbed by the same-named row under "${op.toOccupation}"`,
              metadata: { ...meta, survivingSkillId: atTarget.id, memberReferences: sourceHolders },
            });
            summary.deactivations += 1;
            consolidated = true;
          }
          if (!atTarget.is_active) {
            await client.query(
              `UPDATE skills_taxonomy_skills SET is_active = true, updated_at = NOW() WHERE id = $1`,
              [atTarget.id],
            );
            await recordChangeEvent(client, {
              targetType: 'skill', targetId: atTarget.id, action: 'reactivate',
              reason: `change ${op.id}: consolidateSkill "${op.skill}" — surviving row under "${op.toOccupation}" reactivated`,
              metadata: meta,
            });
            summary.reactivations += 1;
            consolidated = true;
          }
          if (consolidated) {
            summary.applied += 1;
          } else {
            summary.noops += 1;
          }
          break;
        }

        case 'deactivateSkill': {
          const jobTitle = await resolveOccupation(client, op.sector, op.occupation, summary, op.id);
          if (!jobTitle) break;
          const skill = await findSkill(client, jobTitle.id, normalizeTaxonomyName(op.skill));
          if (!skill) {
            summary.missingTargets.push(`skill "${op.skill}" under "${op.occupation}" (change ${op.id})`);
            break;
          }
          if (!skill.is_active) {
            summary.noops += 1;
            break;
          }
          const memberReferences = await countSkillMemberReferences(client, skill.id);
          await client.query(
            `UPDATE skills_taxonomy_skills SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [skill.id],
          );
          await recordChangeEvent(client, {
            targetType: 'skill', targetId: skill.id, action: 'deactivate',
            reason: `change ${op.id}: ${op.acknowledgedImpact}`,
            metadata: { ...meta, memberReferences },
          });
          summary.deactivations += 1;
          summary.applied += 1;
          break;
        }

        case 'deactivateOccupation': {
          const jobTitle = await resolveOccupation(client, op.sector, op.occupation, summary, op.id);
          if (!jobTitle) break;
          if (!jobTitle.is_active) {
            summary.noops += 1;
            break;
          }
          const activeSkills = await client.query(
            `SELECT COUNT(*)::int AS total FROM skills_taxonomy_skills WHERE job_title_id = $1 AND is_active = true`,
            [jobTitle.id],
          );
          if ((activeSkills.rows[0]?.total ?? 0) > 0) {
            throw new Error(`change ${op.id}: occupation "${op.occupation}" still has ${activeSkills.rows[0].total} active skill(s); deactivate or reparent them first.`);
          }
          await client.query(
            `UPDATE skills_taxonomy_job_titles SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [jobTitle.id],
          );
          await recordChangeEvent(client, {
            targetType: 'job-title', targetId: jobTitle.id, action: 'deactivate',
            reason: `change ${op.id}: ${op.acknowledgedImpact}`, metadata: meta,
          });
          summary.deactivations += 1;
          summary.applied += 1;
          break;
        }

        case 'reactivateSkill': {
          const jobTitle = await resolveOccupation(client, op.sector, op.occupation, summary, op.id);
          if (!jobTitle) break;
          const skill = await findSkill(client, jobTitle.id, normalizeTaxonomyName(op.skill));
          if (!skill) {
            summary.missingTargets.push(`skill "${op.skill}" under "${op.occupation}" (change ${op.id})`);
            break;
          }
          if (skill.is_active) {
            summary.noops += 1;
            break;
          }
          await client.query(
            `UPDATE skills_taxonomy_skills SET is_active = true, updated_at = NOW() WHERE id = $1`,
            [skill.id],
          );
          await recordChangeEvent(client, {
            targetType: 'skill', targetId: skill.id, action: 'reactivate',
            reason: `change ${op.id}: reactivateSkill`, metadata: meta,
          });
          summary.reactivations += 1;
          summary.applied += 1;
          break;
        }

        case 'reactivateOccupation': {
          const sector = normalizeTaxonomyName(op.sector);
          const sectorId = await findSectorIdByName(client, sector);
          if (!sectorId) {
            summary.missingSectors.push(`${sector} (change ${op.id})`);
            break;
          }
          const jobTitle = await findJobTitle(client, sectorId, normalizeTaxonomyName(op.occupation));
          if (!jobTitle) {
            summary.missingTargets.push(`occupation "${op.occupation}" in ${sector} (change ${op.id})`);
            break;
          }
          if (jobTitle.is_active) {
            summary.noops += 1;
            break;
          }
          await client.query(
            `UPDATE skills_taxonomy_job_titles SET is_active = true, updated_at = NOW() WHERE id = $1`,
            [jobTitle.id],
          );
          await recordChangeEvent(client, {
            targetType: 'job-title', targetId: jobTitle.id, action: 'reactivate',
            reason: `change ${op.id}: reactivateOccupation`, metadata: meta,
          });
          summary.reactivations += 1;
          summary.applied += 1;
          break;
        }

        default:
          throw new Error(`change ${op.id}: unhandled change type "${op.op}".`);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return summary;
}
