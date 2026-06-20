#!/usr/bin/env node
// Turn free-text "proposed" skills from accepted Skills Hunt nominations into GitHub
// issues that propose adding them to the canonical skills taxonomy, each with an
// AI-suggested sector + occupation.
//
// SAFETY: This script NEVER writes the taxonomy. It only files issues and records a
// dedupe row in skills_hunt_proposed_skill_promotions. Promotion (actually adding a
// skill to skills_taxonomy_skills) is a separate, deliberate, human/agent step done
// from the issue.
//
// What it does, in order:
//   1. Find distinct normalized (trim+lowercase) proposed-skill labels from accepted
//      submissions that are NOT already in the taxonomy (name or alias) and NOT already
//      tracked in skills_hunt_proposed_skill_promotions. Cap at PROPOSAL_LIMIT.
//   2. Load the allowed sectors and allowed occupations (job titles with their sector)
//      from the taxonomy — the model must choose from these.
//   3. For each candidate, ask the Anthropic API to classify it into one allowed
//      sector + one allowed occupation. Validate the answer is in the lists; if not,
//      mark it "needs manual mapping" (never invent values).
//   4. Insert the tracking row with ON CONFLICT (normalized_skill) DO NOTHING. Only if
//      the insert won (a row was returned) do we create the GitHub issue, then update
//      the row with the issue number/url and the suggestion. This makes reruns and
//      overlapping schedules safe — one issue per distinct skill, ever.
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
    throw new Error(`Anthropic API error (HTTP ${response.status}): ${body.slice(0, 300)}`);
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

function buildIssueBody({ skillLabel, sector, occupation, rationale, sourceSubmissionId }) {
  const mapping =
    sector && occupation
      ? `- Suggested sector: **${sector}**\n- Suggested occupation: **${occupation}**`
      : '- **Needs manual mapping** — the AI could not confidently place this skill in an existing sector/occupation.';

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
    `- Source submission id: \`${sourceSubmissionId ?? '(unknown)'}\``,
    '',
    '## What to do',
    '',
    '- **To promote:** add this skill to `skills_taxonomy_skills` under the suggested occupation (hand this issue to an agent, or do it manually). This pipeline never writes the taxonomy itself.',
    '- **To reject:** just delete or close this issue.',
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

  try {
    // 1. Candidate distinct normalized skills from accepted submissions, excluding any
    //    that already exist in the taxonomy (by name or alias) or are already tracked.
    //    Keep one representative original label + one source submission id per skill.
    const candidatesResult = await client.query(
      `WITH proposed AS (
         SELECT
           lower(btrim(elem.value)) AS normalized_skill,
           btrim(elem.value)        AS skill_label,
           s.id                     AS source_submission_id,
           s.created_at             AS submission_created_at
         FROM skills_hunt_submissions s
         CROSS JOIN LATERAL jsonb_array_elements_text(s.proposed_skills) AS elem(value)
         WHERE s.status = 'accepted'
           AND btrim(elem.value) <> ''
       ),
       ranked AS (
         SELECT
           normalized_skill,
           skill_label,
           source_submission_id,
           ROW_NUMBER() OVER (
             PARTITION BY normalized_skill
             ORDER BY submission_created_at ASC, source_submission_id ASC
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
       SELECT r.normalized_skill, r.skill_label, r.source_submission_id
       FROM ranked r
       WHERE r.rn = 1
         AND r.normalized_skill NOT IN (SELECT normalized_skill FROM taxonomy_names)
         AND r.normalized_skill NOT IN (
           SELECT normalized_skill FROM skills_hunt_proposed_skill_promotions
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
      // retried on the next run instead of being permanently skipped by the unique index.
      let rollbackRowId = null;
      try {
        // 4a. Win the dedupe race FIRST. If another run already inserted this skill,
        //     this returns no row and we skip — no duplicate issue is ever filed.
        const insertResult = await client.query(
          `INSERT INTO skills_hunt_proposed_skill_promotions
             (normalized_skill, skill_label, source_submission_id, status)
           VALUES ($1, $2, $3, 'proposed')
           ON CONFLICT (normalized_skill) DO NOTHING
           RETURNING id`,
          [candidate.normalized_skill, candidate.skill_label, candidate.source_submission_id],
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
          } catch {
            // Best-effort cleanup; if it fails the row simply stays and is skipped later.
          }
        }
      }
    }
  } finally {
    await client.end();
  }

  console.log(
    `proposeSkillPromotions: scanned ${scanned}, proposed ${proposed}, skipped-existing ${skippedExisting}, failed ${failed}.`,
  );
}

main().catch((error) => {
  console.error('proposeSkillPromotions failed:', error?.message || error);
  process.exit(1);
});
