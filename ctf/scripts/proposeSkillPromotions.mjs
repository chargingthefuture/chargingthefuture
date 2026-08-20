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
// non-zero so the workflow run goes red rather than passing quietly with nothing filed.
// The red run then has to earn itself: it names WHICH state it is (out of credit, key
// rejected, permission refused, rate limited, vendor down), says in as many words that
// nothing is broken and nothing is lost, and says what to do — on the Actions run page,
// not just in the log. An out-of-credit account and a broken pipeline are the same red X
// otherwise, and the months an account can sit unpaid are exactly when that difference
// matters. The naming comes from the vendor's own machine-readable error type, never from
// reading its prose, and an unrecognized failure is reported as unrecognized rather than
// guessed at — a wrong "out of credit" label once would make every later one unreliable.
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

import { appendFileSync } from 'node:fs';
import pg from 'pg';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// How long a claimed-but-unfiled tracking row is left alone before another run may
// re-claim it. Long enough that two overlapping runs never both file for the same skill,
// short enough that a row left behind by a failed run is retried on the next schedule.
const CLAIM_LEASE_MINUTES = 30;
// Marker the workflow health check looks for in this run's annotations. It means: this run is red
// because of an account or vendor state outside the repo, so it is NOT a defect and nobody should be
// opening a ticket or writing a fix for it. The health check keeps one rolling triage issue for
// failing workflows; without this marker an unfunded account would hold that issue open for as long
// as it stays unfunded, and every agent working the issue would go looking for a bug in a pipeline
// that is working correctly. Deliberately NOT emitted for `unclassified` — an unrecognized failure
// might well be a defect, and it should stay on the triage list. Convention documented in
// .github/workflows/README.md.
const BLOCKED_EXTERNAL_MARKER = 'CTF_RUN_BLOCKED_EXTERNAL';
const LABEL = 'skill-proposal';
const DEFAULT_LIMIT = 10;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    console.error(`proposeSkillPromotions: required environment variable ${name} is not set.`);
    // A missing classification key is the same situation as an unpaid one — an account state,
    // not a defect — so it gets the same plain reading rather than a bare "not set".
    if (name === 'ANTHROPIC_API_KEY') {
      console.error(
        'proposeSkillPromotions: that key is what classifies each proposed skill, so no issues can be ' +
          'filed without it. Nothing is broken and nothing is lost: proposals stay queued on the ' +
          'nominations and Directory entries, and the next run after the key is restored files them all.',
      );
      reportToActions({
        title: 'Skill proposals paused — no Anthropic API key configured (not a code failure).',
        oneLine:
          'ANTHROPIC_API_KEY is not set, so proposed skills cannot be classified. Restore it in Infisical ' +
          '(production). No proposal is lost; the next run after it is restored files the backlog. ' +
          `[${BLOCKED_EXTERNAL_MARKER}:no_key]`,
        summaryMarkdown: [
          '## Skill proposals paused — no Anthropic API key configured (not a code failure).',
          '',
          '`ANTHROPIC_API_KEY` is not set, so proposed skills cannot be classified and no issues can be filed.',
          '',
          '**What to do:** restore the key in Infisical (production).',
          '',
          '**Are the proposals lost?** No. They stay queued on the nominations and Directory entries, and the',
          'next run after the key is restored files the whole backlog on its own.',
        ].join('\n'),
      });
    }
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

// Why the API refused, in plain words, for the cases that will hit EVERY candidate rather
// than just one skill. The run is meant to go red when this happens — but a red scheduled
// run found weeks later is only useful if it says which of these it was. Without that, a
// paid-account-out-of-credit reads exactly like a broken pipeline, and the next person
// (owner or agent) goes looking for a bug that is not there. Each entry says what the state
// is, that it is not a defect, and what — if anything — to do about it.
const API_UNAVAILABLE_REASONS = {
  no_credit: {
    summary: 'the Anthropic account is out of credit',
    detail:
      'This is a billing state, not a defect. The pipeline, the database, and the proposals are all fine — ' +
      'the classification step simply cannot be paid for right now.',
    whatToDo:
      'Add funds to the Anthropic account whenever suits. Nothing in this repo needs changing, and no ' +
      'proposal needs re-entering.',
    titleSuffix: 'not a code failure',
  },
  key_rejected: {
    summary: 'the Anthropic API rejected the key',
    detail:
      'The key is expired, revoked, or otherwise not accepted. This is an account/key state, not a defect in ' +
      'the pipeline — and it is NOT a funding problem.',
    whatToDo:
      'Check ANTHROPIC_API_KEY in Infisical (production) and the standing of the Anthropic account. No code ' +
      'change is involved.',
    titleSuffix: 'not a code failure',
  },
  access_denied: {
    summary: 'the Anthropic API refused the key permission for this request',
    detail:
      'The key is valid but is not allowed to use what this run asked for (commonly the model). This is NOT a ' +
      'funding problem and NOT a defect in the pipeline — nothing here is out of credit.',
    whatToDo:
      'Check what the key is scoped to in the Anthropic dashboard against the model this script asks for ' +
      "(see ANTHROPIC_MODEL at the top of the file).",
    titleSuffix: 'not a code failure',
  },
  rate_limited: {
    summary: 'the Anthropic API rate-limited this run',
    detail: 'A temporary throttle on their side. Not a funding problem and not a defect in the pipeline.',
    whatToDo: 'Nothing. The next scheduled run picks the same skills back up.',
    titleSuffix: 'not a code failure',
  },
  vendor_down: {
    summary: 'the Anthropic API is erroring on their side',
    detail: 'An outage or server error at the vendor. Not a funding problem and not a defect in the pipeline.',
    whatToDo: 'Nothing. The next scheduled run picks the same skills back up.',
    titleSuffix: 'not a code failure',
  },
  // The honest answer when the vendor's own error type is not one this script knows. Guessing here is
  // what makes a red run untrustworthy: label an unknown failure "out of credit" once and every future
  // out-of-credit reading has to be double-checked. So this state says plainly that it is NOT a known
  // funding state and asks for a look.
  unclassified: {
    summary: 'the Anthropic API refused in a way this script does not recognize',
    detail:
      'This is NOT a known funding or throttling state — do not read it as "the account needs topping up". ' +
      'It could be a request this script sends wrongly, or a vendor error type added since this was written.',
    whatToDo:
      'Read the message above. If it names billing or a credit balance, the account needs funds. Otherwise ' +
      'treat it as something to investigate in the script.',
    titleSuffix: 'needs a look',
  },
};

// The vendor names the failure in its response envelope: {"type":"error","error":{"type":…,"message":…}}.
// That type string is the reliable signal, and the only way to tell the two cases that share HTTP 403
// apart — billing_error (out of funds) from permission_error (key not allowed). Reading the prose
// instead is how a non-funding failure ends up labeled a funding one.
const REASON_BY_ERROR_TYPE = {
  billing_error: 'no_credit',
  authentication_error: 'key_rejected',
  permission_error: 'access_denied',
  rate_limit_error: 'rate_limited',
  api_error: 'vendor_down',
  overloaded_error: 'vendor_down',
};

// Which reason above this answer is, or null when the failure does not obviously hit every
// candidate and the run should carry on to the next skill.
//
// The vendor's own error type decides it whenever the body carries one — never the prose, and never
// the status alone. Two rules keep a non-funding failure from ever reading as a funding one:
//   * 403 with no readable type stays `unclassified`, because billing_error and permission_error
//     share that status and guessing between them is exactly the mislabel worth avoiding.
//   * a 400 is only `no_credit` if the message actually names the credit balance (the documented
//     wording for an unfunded account). Every other 400 is a malformed request — a defect — so it is
//     left to fail per-skill and read as one, not dressed up as an account state.
function apiUnavailableReason(status, body) {
  const errorType = vendorErrorTypeFrom(body);
  if (errorType && REASON_BY_ERROR_TYPE[errorType]) return REASON_BY_ERROR_TYPE[errorType];

  // 402 is not part of the documented set, but Payment Required is unambiguous if a proxy sends it.
  if (status === 402) return 'no_credit';
  if (status === 400) return /credit balance/i.test(body) ? 'no_credit' : null;
  if (status === 401) return 'key_rejected';
  if (status === 403) return 'unclassified';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'vendor_down';
  return null;
}

// The machine-readable failure name from the vendor envelope, or null when the body carries none
// (a proxy or gateway page). Kept separate from the human message so neither has to guess at the other.
function vendorErrorTypeFrom(body) {
  try {
    const errorType = JSON.parse(body)?.error?.type;
    return typeof errorType === 'string' && errorType.trim() ? errorType.trim() : null;
  } catch {
    // no-trace: a non-JSON body is normal for a proxy or gateway error page; the caller falls back to status.
  }
  return null;
}

// The vendor answers with a JSON envelope. Pull out its human sentence so the log reads as a
// sentence rather than as raw JSON. Never includes the key — the body carries no secret, and
// it is capped either way.
function vendorMessageFrom(body) {
  try {
    const message = JSON.parse(body)?.error?.message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 300);
  } catch {
    // no-trace: a non-JSON body is normal for a proxy or gateway error page; the raw text below is the message.
  }
  return body.trim().slice(0, 300) || '(the response body was empty)';
}

// Put the same explanation on the GitHub Actions run page — the annotation line and the job
// summary — so the red run says why without anyone opening the log and reading vendor JSON.
// Does nothing outside Actions.
function reportToActions({ title, oneLine, summaryMarkdown }) {
  if (!process.env.GITHUB_ACTIONS) return;
  // Annotations are single-line; collapse newlines and neutralize the :: delimiter.
  const clean = (text) => text.replace(/\r?\n/g, ' ').replace(/::/g, ':');
  console.log(`::error title=${clean(title)}::${clean(oneLine)}`);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  try {
    appendFileSync(summaryPath, `${summaryMarkdown}\n`);
  } catch (summaryError) {
    // Non-fatal: the summary only mirrors the log, which already carries the same text. Say
    // why it could not be written rather than leaving an unexplained missing summary.
    console.error(
      `proposeSkillPromotions: could not write the job summary: ${summaryError?.message || summaryError}`,
    );
  }
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
    // Do not surface the key; just the status and the vendor's own sentence.
    const body = await response.text();
    const vendorMessage = vendorMessageFrom(body);
    const error = new Error(`Anthropic API error (HTTP ${response.status}): ${vendorMessage}`);
    // Set when this failure will hit every candidate, so the caller stops the run here and
    // reports which state it was rather than retrying the same outage nine more times.
    error.apiUnavailableReason = apiUnavailableReason(response.status, body);
    error.apiStatus = response.status;
    error.vendorMessage = vendorMessage;
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
  // and reports which state it was instead of retrying the same outage nine more times.
  let blocked = null;

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
        if (error?.apiUnavailableReason) {
          blocked = {
            reason: error.apiUnavailableReason,
            status: error.apiStatus,
            vendorMessage: error.vendorMessage || error?.message || String(error),
          };
          console.error(
            'proposeSkillPromotions: this failure hits every candidate, so the rest of this run is skipped. ' +
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
  //
  // Red is the point, but red alone is a false alarm: an out-of-credit account and a broken
  // pipeline look identical from the Actions list. So the report below names which state it
  // is, says outright that nothing is broken and nothing is lost, and says what to do — so
  // the run can be read at a glance weeks later without anyone debugging a non-defect.
  if (blocked) {
    const { summary, detail, whatToDo, titleSuffix } = API_UNAVAILABLE_REASONS[blocked.reason];
    const headline = `Skill proposals paused — ${summary} (${titleSuffix}).`;
    console.error(
      [
        `proposeSkillPromotions: STOPPED — ${summary}.`,
        `  What this is: ${detail}`,
        `  The API said (HTTP ${blocked.status}): ${blocked.vendorMessage}`,
        `  Reason code: ${blocked.reason}`,
        '  Nothing is broken and nothing is lost. Every proposed skill is still queued: the pipeline reads',
        '  them off the accepted nominations and the Directory entries on every run and never marks them',
        '  used, so the next run after this clears files the whole backlog on its own.',
        `  Issues filed this run: ${proposed}.`,
        `  What to do: ${whatToDo}`,
        '  This run is red on purpose — a scheduled run that files nothing must not look healthy.',
      ].join('\n'),
    );
    // Only the states that are definitely an outside-the-repo condition carry the marker;
    // `unclassified` stays on the health check's triage list because it might be a defect.
    const externalMarker =
      blocked.reason === 'unclassified' ? '' : ` [${BLOCKED_EXTERNAL_MARKER}:${blocked.reason}]`;
    reportToActions({
      title: headline,
      oneLine:
        `${detail} ${whatToDo} No proposal is lost; the next run after this clears files the backlog.` +
        externalMarker,
      summaryMarkdown: [
        `## ${headline}`,
        '',
        detail,
        '',
        `**The API said (HTTP ${blocked.status}):** ${blocked.vendorMessage}`,
        '',
        `**What to do:** ${whatToDo}`,
        '',
        '**Are the proposals lost?** No. The pipeline reads proposed skills off the accepted nominations and',
        'the Directory entries on every run and never marks them used, so nothing needs re-entering — the',
        'next run after this clears files the whole backlog on its own.',
        '',
        `Issues filed this run: ${proposed}. This run is red on purpose: a scheduled run that files nothing`,
        'must not look healthy.',
      ].join('\n'),
    });
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
