#!/usr/bin/env node
/*
 * renameComicSpaceTitle — update the stored title on comic_knowledge_entries rows
 * whose title is the old Quora space name, after the owner renamed the space.
 *
 * Why this exists: the seed import maps each row's `space` to its knowledge-entry
 * `title` when the row has no explicit title (see importComicKnowledge.mjs). The
 * space was renamed on Quora from "TI Skills Network" (subdomain
 * tiskillsnetwork.quora.com) to "Skills Economy" (skillseconomy.quora.com), and the
 * seed file was updated to match — but rows already imported into the production
 * table still carry the old title, and retrieveComicGrounding() can inject that title
 * into a model prompt. This one-time script brings the live rows in step.
 *
 * Scope is deliberately narrow: it matches the title EXACTLY against the old space
 * name, so it only touches the space-post rows (whose title is exactly the space
 * name) and never an answer row whose question text happens to mention the network.
 * It changes only `title`. It does NOT touch `content` — a member's own words are
 * kept verbatim — and `content` is where the string also appears, so those rows'
 * content is intentionally left as written.
 *
 * `content_hash` is computed from entry_type + question + content only (see
 * importComicKnowledge.mjs / scrubComicKnowledgeIdentifiers.mjs), NOT from title, so
 * renaming the title does not change any hash and cannot cause a uniqueness clash or
 * break import idempotency.
 *
 * DRY RUN BY DEFAULT. Nothing is written unless --apply is passed. The dry run prints
 * every row that would change, with its before/after title, so the change can be
 * reviewed before it happens.
 *
 * Usage:
 *   DATABASE_URL=<conn> node ctf/scripts/renameComicSpaceTitle.mjs           # preview
 *   DATABASE_URL=<conn> node ctf/scripts/renameComicSpaceTitle.mjs --apply   # write
 *
 * DELETE AFTER USE: once an apply run finishes green, delete this file and
 * .github/workflows/rename-comic-space-title.yml. The seed file already carries the
 * new name, so a future re-import needs no further correction and this catch-up
 * script is not needed again.
 */

import pg from "pg";

const { Pool } = pg;
const APPLY = process.argv.includes("--apply");

// Old space title -> new space title. Exact match on the stored `title`.
const RENAMES = new Map([["TI Skills Network", "Skills Economy"]]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

let changed = 0;

try {
  const oldTitles = [...RENAMES.keys()];
  const { rows } = await pool.query(
    `SELECT id, title, active
     FROM comic_knowledge_entries
     WHERE title = ANY($1::text[])
     ORDER BY id`,
    [oldTitles],
  );

  for (const row of rows) {
    const newTitle = RENAMES.get(row.title);
    if (!newTitle || newTitle === row.title) continue;

    changed++;
    console.log("=".repeat(74));
    console.log(`row ${row.id}  active=${row.active}`);
    console.log(`  before: ${row.title}`);
    console.log(`  after:  ${newTitle}`);

    if (!APPLY) continue;

    await pool.query(`UPDATE comic_knowledge_entries SET title = $2 WHERE id = $1`, [row.id, newTitle]);
    console.log("  -> updated");
  }

  console.log("=".repeat(74));
  if (APPLY) {
    console.log(`Updated ${changed} row(s) to the new space title.`);
  } else {
    console.log(`DRY RUN — ${changed} row(s) would change. Re-run with --apply to write.`);
  }
} finally {
  await pool.end();
}
