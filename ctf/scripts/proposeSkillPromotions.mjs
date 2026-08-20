#!/usr/bin/env node
// Turn free-text "proposed" skills into GitHub issues that propose adding them to the
// canonical skills taxonomy, each with an AI-suggested sector + occupation. This is the
// single cross-app intake: it scans every source that lets a member name a skill not yet
// in the taxonomy — accepted SkillsHunt nominations AND the Directory "skill not listed"
// box — so all addition requests land in ONE review queue (these issues), reviewed and
// approved in one place. The filed issue records which app the skill came from.
//
// SAFETY: This script NEVER writes the taxonomy. It only files issues and records a
// dedupe row in skills_hunt_proposed_skill_promotions. Promotion (actually adding a
// skill to skills_taxonomy_skills) is a separate, deliberate, human/agent step done
// from the issue.
//
// What it does, in order:
//   1. Find distinct normalized (trim+lowercase) proposed-skill labels from accepted
//      SkillsHunt submissions AND pending Directory "skill not listed" entries that are
//      NOT already in the taxonomy (name or alias) and do NOT already have a filed issue
//      in skills_hunt_proposed_skill_promotions. One row per distinct skill (the earliest
//      source wins as the representative). Cap at PROPOSAL_LIMIT.
//   2. Load the allowed sectors and allowed occupations (job titles with their sector)
//      from the taxonomy — the model must choose from these.
//   3. For each candidate, ask the Anthropic API to classify it into one allowed
//      sector + one allowed occupation. Validate the answer is in the lists; if not,
//      mark it "needs manual mapping" (never invent values).
//   4. Claim the tracking row before filing: insert it, or re-claim an existing row that
//      never got an issue filed and whose claim is older than CLAIM_LEASE_MINUTES. Only
//      if the claim won (a row was returned) do we create the GitHub issue, then update
//      the row with the issue number/url and the suggestion. This makes reruns and
//      overlapping schedules safe — one issue per distinct skill, ever — while making
//      sure a skill whose earlier attempt died mid-way is tried again rather than being
//      skipped for good.
//
// WHEN THE ANTHROPIC API IS UNAVAILABLE (no credit, no key, rate limited, vendor down):
// nothing is lost. The failing skill keeps no issue and its claimed row is released, so
// the next scheduled run picks it up again from the same submissions. The run stops at
// the first such failure instead of burning the rest of the candidates, and exits
// non-zero so the workflow run goes red and says why, rather than passing quietly with
// nothing filed.
//
// Required environment:
//   DATABASE_URL        Postgres connection string (the app database).
//   ANTHROPIC_API_KEY   Anthropic API key (used to classify each skill).
//   GITHUB_TOKEN        A token with `issues: write` on this repo.
//   GITHUB_REPOSITORY   "owner/repo" (GitHub Actions provides this).
// Optional:
//   PROPOSAL_LIMIT      Max skills to process per run (default 10).
//
// Never prints secret values.

import pg from 'pg';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// How long a claimed-but-unfiled tracking row is left alone before another run may
// re-claim it. Long enough that two overlapping runs never both file for the same skill,
// short enough that a row left behind by a failed run is retried on the next schedule.
const CLAIM_LEASE_MINUTES = 30;
const LABEL = 'skill-proposal';
const DEFAULT_LIMIT = 10;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    console.error(`proposeSkillPromotions: required environment variable ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

const DATABASE_URL = requireEnv('DATABASE_URL');
const ANTHROPIC_API_KEY = requireEnv('ANTHROPIC_API_KEY');
const GITHUB_TOKEN = requireEnv('GITHUB_TOKEN');
const GITHUB_REPOSITORY = requireEnv('GITHUB_REPOSITORY');

const parsedLimit = Number.parseInt(process.env.PROPOSAL_LIMIT ?? '', 10);
const PROPOSAL_LIMIT = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;

const GITHUB_API = 'https://api.github.com';

function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ctf-propose-skill-promotions',
  };
}

// True when the API answer means the API is unavailable for EVERY candidate, not just this
// one: no key or no credit (401/402/403), rate limited (429), or the vendor is down (5xx).
// A paused account with no funds answers 400 with a credit-balance message, so that counts
// too. There is no point trying the remaining candidates in the same run.
function isApiUnavailable(status, body) {
  if (status === 401 || status === 402 || status === 403 || status === 429 || status >= 500) {
    return true;
  }
  return status === 400 && /credit balance|billing|quota|insufficient/i.test(body);
}

// Models sometimes wrap JSON in markdown code fences despite instructions not to.
function stripCodeFences(text) {
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : text;
}

// Make sure the skill-proposal label exists; create it if missing. Idempotent.
async function ensureLabel() {
  const getRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPOSITORY}/labels/${encodeURIComponent(LABEL)}`, {
    headers: ghHeaders(),
  });
  if (getRes.ok) return;
  if (getRes.status !== 404) {
    throw new Error(`Failed to look up the ${LABEL} label (HTTP ${getRes.status}).`);
  }
  const createRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPOSITORY}/labels`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({
      name: LABEL,
      color: '0e8a16',
      description: 'A free-text skill proposed for the canonical taxonomy (AI-suggested sector/occupation).',
    }),
  });
  // 422 means it already exists (created concurrently) — that is fine.
  if (!createRes.ok && createRes.status !== 422) {
    throw new Error(`Failed to create the ${LABEL} label (HTTP ${createRes.status}).`);
  }
}

// Ask the model to map one skill into the allowed sector + occupation lists.
// Returns { sector, occupation, rationale } where sector/occupation are either a
// valid member of the lists or null when the model could not pick a valid one.
async function classifySkill(skillLabel, sectorNames, occupations) {
  const sectorList = sectorNames.map((s) => `- ${s}`).join('\n');
  const occupationList = occupations.map((o) => `- ${o.name} (sector: ${o.sector})`).join('\n');

  const system = [
    'You classify a single vocational skill into a community\'s existing skills taxonomy.',
    'The taxonomy is fixed. You may ONLY choose from the allowed lists below — never invent a sector or occupation.',
    '',
    'ALLOWED SECTORS:',
    sectorList,
    '',
    'ALLOWED OCCUPATIONS (each shown with the sector it belongs to):',
    occupationList,
    '',
    'Pick the single best-fitting sector and the single best-fitting occupation for the skill.',
    'The occupation you pick should normally belong to the sector you pick.',
    'Return ONLY a JSON object, no markdown fences and no preamble, with exactly these keys:',
    '{"sector": "<one of the allowed sectors>", "occupation": "<one of the allowed occupations>", "rationale": "<one sentence explaining the choice>"}',
  ].join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      system,
      messages: [
        {
          role: 'user',
          content: `Skill to classify: "${skillLabel}"\n\nReturn ONLY the JSON object.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    // Do not surface the key; just the status and a short body for debugging.
    const body = await response.text();
    const error = new Error(`Anthropic API error (HTTP ${response.status}): ${body.slice(0, 300)}`);
    // Tells the caller this failure will hit every candidate, so stop the run here.
    error.apiUnavailable = isApiUnavailable(response.status, body);
    throw error;
  }

  const result = await response.json();
  const raw = (result?.content?.[0]?.text ?? '').trim();
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    return { sector: null, occupation: null, rationale: 'Model returned unparseable output; needs manual mapping.' };
  }

  const sectorSet = new Set(sectorNames);
  const occupationSet = new Set(occupations.map((o) => o.name));
  const sector = typeof parsed.sector === 'string' && sectorSet.has(parsed.sector) ? parsed.sector : null;
  const occupation =
    typeof parsed.occupation === 'string' && occupationSet.has(parsed.occupation) ? parsed.occupation : null;
  const rationale =
    typeof parsed.rationale === 'string' && parsed.rationale.trim()
      ? parsed.rationale.trim()
      : 'No rationale provided.';

  return { sector, occupation, rationale };
}

function buildIssueBody({ skillLabel, sector, occupation, rationale, source, sourceSubmissionId }) {
  const mapping =
    sector && occupation
      ? `- Suggested sector: **${sector}**\n- Suggested occupation: **${occupation}**`
      : '- **Needs manual mapping** — the AI could not confidently place this skill in an existing sector/occupation.';

  const sourceLabel =
    source === 'directory'
      ? 'Directory — a member added it through the "skill not listed" box on their own profile'
      : source === 'skills-hunt'
        ? 'SkillsHunt — proposed on an accepted nomination'
        : (source ?? 'unknown');

  const lines = [
    'A scout proposed a skill that is not yet in the canonical skills taxonomy.',
    '',
    `## Proposed skill`,
    '',
    `**${skillLabel}**`,
    '',
    '## AI-suggested placement',
    '',
    mapping,
    '',
    `> Why: ${rationale}`,
    '',
    '> Caveat: the sector and occupation above are an AI guess, not a decision. Check them before promoting.',
    '',
    '## Source',
    '',
    `- Source app: ${sourceLabel}`,
    `- Source submission id: \`${sourceSubmissionId ?? '(not applicable)'}\``,
    '',
    '## What to do',
    '',
    '- **To promote:** add this skill to `skills_taxonomy_skills` under the suggested occupation (hand this issue to an agent, or do it manually). This pipeline never writes the taxonomy itself.',
    '- **To reject:** just delete or close this issue.',
    '',
    '## Context for the agent picking this up',
    '',
    'The taxonomy model is three levels: sector, then occupation (job title), then skill. Every',
    'skill must map to an occupation, and every occupation must map to a sector. There is no skill',
    'that floats free of an occupation, and no occupation that floats free of a sector.',
    '',
    'The tables and how they chain together:',
    '',
    '- `skills_taxonomy_sectors` — the top level (for example "Professional & Business Services").',
    '- `skills_taxonomy_job_titles` — occupations; each row has a `sector_id` pointing at its sector.',
    '- `skills_taxonomy_skills` — skills; each row has a `job_title_id` pointing at its occupation.',
    '  A skill row carries a single `job_title_id`, so the same skill name may legitimately exist',
    '  under several occupations.',
    '- Directory profiles reference taxonomy skills through `directory_profile_skills.skill_id`,',
    '  which points at `skills_taxonomy_skills.id` (taxonomy foreign key only, no free text).',
    '',
    'Where the relevant code lives:',
    '',
    '- The taxonomy table definitions are in `ctf/schema.sql` (the skills_taxonomy block).',
    '- The LIVE database is the source of truth for the taxonomy. The old legacy platform dataset',
    '  and its sync were removed with the legacy app; do not look for or rebuild them.',
    '- The append-only change list is the only repo path that writes the taxonomy. It lives in',
    '  `ctf/scripts/lib/taxonomyChange.mjs`, is validated by CI on every PR, and is applied',
    '  idempotently by `node ctf/scripts/seedSkillsTaxonomy.mjs` via the owner-run',
    '  `seed-skills-taxonomy.yml` workflow. Sectors are looked up by name in the live DB (never',
    '  created); reseeds keep every applied change. Governance:',
    '  `ctf/docs/developer/SKILLS_TAXONOMY_CHANGE_GOVERNANCE_PLAN.md`.',
    '- The directory read that loads a profile\'s taxonomy skills is in',
    '  `ctf/packages/web/lib/directory/repository.ts` (loadProfileSkills).',
    '- The Skills Taxonomy plugin shell is under',
    '  `ctf/packages/web/components/skills-taxonomy/`.',
    '',
    'How to promote a skill:',
    '',
    '1. Decide the occupation this skill belongs under. If that occupation does not already exist,',
    '   append an `addOccupation` op first (an occupation must always have a sector; sectors are',
    '   never created by ops).',
    '2. Append an `addSkill` op (with `proposalNormalizedSkills` naming this proposal\'s label) to',
    '   `TAXONOMY_CHANGES` in `ctf/scripts/lib/taxonomyChange.mjs`, in a PR. Never edit or',
    '   reorder existing ops — append only.',
    '3. CI validates the ops list on the PR. After merge, the owner runs the',
    '   `Skills Taxonomy — Apply Changes (production)` workflow to apply it to the live DB;',
    '   that run also marks this proposal `promoted` and attaches the skill to proposing members.',
    '4. A change op is data only — no schema change, so `schema.demo.sql` is untouched.',
    '5. The directory then displays the promoted skill once a profile references it through',
    '   `directory_profile_skills`.',
  ];
  return lines.join('\n');
}

async function createIssue({ skillLabel, body }) {
  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPOSITORY}/issues`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({
      title: `Skill proposal: ${skillLabel}`,
      body,
      labels: [LABEL],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create issue (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const issue = await res.json();
  return { number: issue.number, url: issue.html_url };
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  let scanned = 0;
  let proposed = 0;
  let skippedExisting = 0;
  let failed = 0;
  // Set when the API answered in a way that will hit every candidate, so the run stops
  // and reports instead of retrying the same outage nine more times.
  let blockedReason = null;

  try {
    // 1. Candidate distinct normalized skills from BOTH sources (accepted SkillsHunt
    //    nominations + pending Directory "skill not listed" entries), excluding any that
    //    already exist in the taxonomy (by name or alias) or already have an issue filed.
    //    A tracking row with no issue number is NOT excluded: it is a claim from an
    //    earlier run that never finished, so the skill stays a candidate and the claim
    //    step below decides whether this run may take it. Keep one representative label
    //    per normalized skill (earliest wins), with its source.
    const candidatesResult = await client.query(
      `WITH proposed AS (
         -- SkillsHunt: free-text skills on accepted nominations.
         SELECT
           lower(btrim(elem.value)) AS normalized_skill,
           btrim(elem.value)        AS skill_label,
           s.id                     AS source_submission_id,
           'skills-hunt'            AS source,
           s.created_at             AS candidate_created_at
         FROM skills_hunt_submissions s
         CROSS JOIN LATERAL jsonb_array_elements_text(s.proposed_skills) AS elem(value)
         WHERE s.status = 'accepted'
           AND btrim(elem.value) <> ''
         UNION ALL
         -- Directory: "skill not listed" labels a member added to their own profile.
         SELECT
           lower(btrim(d.skill_label)) AS normalized_skill,
           btrim(d.skill_label)        AS skill_label,
           NULL::uuid                  AS source_submission_id,
           'directory'                 AS source,
           d.created_at                AS candidate_created_at
         FROM directory_profile_proposed_skills d
         WHERE d.status = 'pending'
           AND btrim(d.skill_label) <> ''
       ),
       ranked AS (
         SELECT
           normalized_skill,
           skill_label,
           source_submission_id,
           source,
           ROW_NUMBER() OVER (
             PARTITION BY normalized_skill
             ORDER BY candidate_created_at ASC, source_submission_id ASC NULLS LAST
           ) AS rn
         FROM proposed
       ),
       taxonomy_names AS (
         SELECT lower(btrim(name)) AS normalized_skill FROM skills_taxonomy_skills
         UNION
         SELECT lower(btrim(alias.value)) AS normalized_skill
         FROM skills_taxonomy_skills t
         CROSS JOIN LATERAL jsonb_array_elements_text(t.aliases) AS alias(value)
       )
       SELECT r.normalized_skill, r.skill_label, r.source_submission_id, r.source
       FROM ranked r
       WHERE r.rn = 1
         AND r.normalized_skill NOT IN (SELECT normalized_skill FROM taxonomy_names)
         AND r.normalized_skill NOT IN (
           SELECT normalized_skill FROM skills_hunt_proposed_skill_promotions
           WHERE issue_number IS NOT NULL
         )
       ORDER BY r.skill_label ASC
       LIMIT $1`,
      [PROPOSAL_LIMIT],
    );

    const candidates = candidatesResult.rows;
    scanned = candidates.length;

    if (scanned === 0) {
      console.log('proposeSkillPromotions: no new proposed skills to process.');
      return;
    }

    // 2. Allowed choice lists from the taxonomy.
    const sectorsResult = await client.query(
      `SELECT name FROM skills_taxonomy_sectors WHERE is_active = TRUE ORDER BY name ASC`,
    );
    const occupationsResult = await client.query(
      `SELECT jt.name AS name, sec.name AS sector
         FROM skills_taxonomy_job_titles jt
         JOIN skills_taxonomy_sectors sec ON sec.id = jt.sector_id
        WHERE jt.is_active = TRUE
        ORDER BY jt.name ASC`,
    );
    const sectorNames = sectorsResult.rows.map((r) => r.name);
    const occupations = occupationsResult.rows.map((r) => ({ name: r.name, sector: r.sector }));

    if (sectorNames.length === 0 || occupations.length === 0) {
      console.error('proposeSkillPromotions: taxonomy has no sectors or occupations; cannot classify.');
      process.exit(1);
    }

    // Make sure the label exists once up front.
    await ensureLabel();

    for (const candidate of candidates) {
      // Set once we own the dedupe row; cleared once the issue is fully recorded. If the
      // classify/issue steps throw in between, the catch deletes this row so the skill is
      // retried on the next run. The claim lease below is the backstop for when even that
      // delete cannot run (the database went away), so a skill is never dropped for good.
      let rollbackRowId = null;
      try {
        // 4a. Win the dedupe race FIRST. A skill nobody has claimed inserts. A row an
        //     earlier run claimed but never filed an issue for is re-claimed once its
        //     lease has expired. A row that already carries an issue number, or that
        //     another run claimed moments ago, returns nothing and is skipped — so no
        //     duplicate issue is ever filed.
        const insertResult = await client.query(
          `INSERT INTO skills_hunt_proposed_skill_promotions
             (normalized_skill, skill_label, source_submission_id, source, status)
           VALUES ($1, $2, $3, $4, 'proposed')
           ON CONFLICT (normalized_skill) DO UPDATE
             SET skill_label = EXCLUDED.skill_label,
                 source_submission_id = EXCLUDED.source_submission_id,
                 source = EXCLUDED.source,
                 status = 'proposed',
                 updated_at = NOW()
             WHERE skills_hunt_proposed_skill_promotions.issue_number IS NULL
               AND skills_hunt_proposed_skill_promotions.updated_at
                     < NOW() - make_interval(mins => $5::int)
           RETURNING id`,
          [
            candidate.normalized_skill,
            candidate.skill_label,
            candidate.source_submission_id,
            candidate.source,
            CLAIM_LEASE_MINUTES,
          ],
        );

        if (insertResult.rowCount === 0) {
          skippedExisting += 1;
          continue;
        }

        const rowId = insertResult.rows[0].id;
        rollbackRowId = rowId;

        // 3. Classify (only after we own the row, so we never burn API calls on dupes).
        const { sector, occupation, rationale } = await classifySkill(
          candidate.skill_label,
          sectorNames,
          occupations,
        );

        // 4b. File the issue.
        const body = buildIssueBody({
          skillLabel: candidate.skill_label,
          sector,
          occupation,
          rationale,
          source: candidate.source,
          sourceSubmissionId: candidate.source_submission_id,
        });
        const { number, url } = await createIssue({ skillLabel: candidate.skill_label, body });

        // 4c. Record what we filed.
        await client.query(
          `UPDATE skills_hunt_proposed_skill_promotions
              SET issue_number = $2,
                  issue_url = $3,
                  suggested_sector = $4,
                  suggested_occupation = $5,
                  status = 'issue_created',
                  updated_at = NOW()
            WHERE id = $1`,
          [rowId, number, url, sector, occupation],
        );

        rollbackRowId = null;
        proposed += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `proposeSkillPromotions: failed to process "${candidate.skill_label}": ${error?.message || error}`,
        );
        // Roll back the dedupe row (only if the issue was never filed) so a transient
        // classify/issue failure retries next run rather than dropping the skill forever.
        if (rollbackRowId) {
          try {
            await client.query(
              'DELETE FROM skills_hunt_proposed_skill_promotions WHERE id = $1 AND issue_number IS NULL',
              [rollbackRowId],
            );
          } catch (cleanupError) {
            // Non-fatal: the claim lease lets a later run re-take this row anyway, so the
            // skill is still retried. Say what failed so the leftover row is explainable.
            console.error(
              `proposeSkillPromotions: could not release the claim on "${candidate.skill_label}" after ` +
                `the failure above: ${cleanupError?.message || cleanupError}. The row stays claimed and a ` +
                `later run re-takes it after ${CLAIM_LEASE_MINUTES} minutes.`,
            );
          }
        }
        if (error?.apiUnavailable) {
          blockedReason = error?.message || String(error);
          console.error(
            'proposeSkillPromotions: the Anthropic API is unavailable for every candidate, so the rest of this run is skipped. ' +
              'No proposal is lost — a skill with no issue filed stays a candidate and the next run picks it up from the same submissions.',
          );
          break;
        }
      }
    }
  } finally {
    await client.end();
  }

  console.log(
    `proposeSkillPromotions: scanned ${scanned}, proposed ${proposed}, skipped-existing ${skippedExisting}, failed ${failed}.`,
  );

  // A scheduled script that fails and still exits 0 hides the outage: the run stays green
  // while nothing gets filed, and nobody finds out until someone goes looking for the
  // issues. Exit non-zero when the API blocked the run, or when everything tried failed.
  if (blockedReason) {
    console.error(
      `proposeSkillPromotions: run stopped early because the classification API is unavailable — ${blockedReason}`,
    );
    process.exitCode = 1;
    return;
  }
  if (failed > 0 && proposed === 0) {
    console.error(
      'proposeSkillPromotions: every candidate in this run failed; see the per-skill reasons above. Each one stays a candidate for the next run.',
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('proposeSkillPromotions failed:', error?.message || error);
  process.exit(1);
});
