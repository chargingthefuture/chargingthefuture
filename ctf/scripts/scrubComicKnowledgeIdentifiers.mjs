#!/usr/bin/env node
/*
 * scrubComicKnowledgeIdentifiers — re-run the current redaction over rows already
 * stored in comic_knowledge_entries (issue #1912).
 *
 * Why this exists: the first seed import ran before redact() covered Quora profile
 * URLs and @handles, so live rows can carry a third party's identity. Those rows are
 * active, so retrieveComicGrounding() can inject them into the model prompt and a
 * draft could surface another member's name.
 *
 * It re-applies the SAME redact() the parsers use (ctf/scripts/lib/comicDatasetShared.mjs),
 * so there is one redaction rule in one place — this script can never drift from the
 * parsers' behaviour.
 *
 * DRY RUN BY DEFAULT. Nothing is written unless --apply is passed. The dry run prints
 * every row that would change, with a before/after of the affected line, so the change
 * can be reviewed before it happens.
 *
 * Usage:
 *   DATABASE_URL=<conn> node ctf/scripts/scrubComicKnowledgeIdentifiers.mjs           # preview
 *   DATABASE_URL=<conn> node ctf/scripts/scrubComicKnowledgeIdentifiers.mjs --apply   # write
 *
 * content_hash is recomputed for every changed row, using the same formula as
 * importComicKnowledge.mjs, so re-importing a corrected seed file stays idempotent and
 * cannot resurrect the unredacted original. If a recomputed hash collides with another
 * row (the corrected text already exists), the duplicate is deactivated (active = FALSE)
 * rather than deleted — curation in this table is an off-switch, never a hard delete.
 */

import { createHash } from "node:crypto";
import pg from "pg";
import { redact } from "./lib/comicDatasetShared.mjs";

const { Pool } = pg;
const APPLY = process.argv.includes("--apply");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

// Same hash formula as importComicKnowledge.mjs — keep these in step.
function hashOf(entryType, question, content) {
  return createHash("sha256")
    .update(entryType + " " + (question || "") + " " + content.trim())
    .digest("hex");
}

// Show the first line that actually changed, so a reviewer sees the edit in context
// rather than a wall of unchanged text.
function firstChangedLine(before, after) {
  const b = before.split("\n");
  const a = after.split("\n");
  for (let i = 0; i < Math.max(b.length, a.length); i++) {
    if (b[i] !== a[i]) {
      return { before: (b[i] || "").trim().slice(0, 160), after: (a[i] || "").trim().slice(0, 160) };
    }
  }
  return null;
}

const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

let scanned = 0;
let changed = 0;
let deactivated = 0;

try {
  const { rows } = await pool.query(
    `SELECT id, entry_type, question, content, content_hash, active
     FROM comic_knowledge_entries
     ORDER BY id`,
  );
  scanned = rows.length;

  for (const row of rows) {
    const newQuestion = row.question ? redact(row.question) : row.question;
    const newContent = redact(row.content);
    if (newQuestion === row.question && newContent === row.content) continue;

    changed++;
    const newHash = hashOf(row.entry_type, newQuestion, newContent);
    const diff = firstChangedLine(row.content, newContent) || firstChangedLine(row.question || "", newQuestion || "");

    console.log("=".repeat(74));
    console.log(`row ${row.id}  type=${row.entry_type}  active=${row.active}`);
    if (diff) {
      console.log(`  before: ${diff.before}`);
      console.log(`  after:  ${diff.after}`);
    }

    if (!APPLY) continue;

    // A corrected row may now be identical to an existing one. content_hash is UNIQUE,
    // so deactivate the duplicate instead of failing the run.
    const clash = await pool.query(
      `SELECT id FROM comic_knowledge_entries WHERE content_hash = $1 AND id <> $2 LIMIT 1`,
      [newHash, row.id],
    );
    if (clash.rowCount > 0) {
      await pool.query(`UPDATE comic_knowledge_entries SET active = FALSE WHERE id = $1`, [row.id]);
      deactivated++;
      console.log(`  -> duplicate of row ${clash.rows[0].id} after redaction; deactivated instead of updated`);
      continue;
    }

    await pool.query(
      `UPDATE comic_knowledge_entries
       SET question = $2, content = $3, content_hash = $4
       WHERE id = $1`,
      [row.id, newQuestion, newContent, newHash],
    );
    console.log("  -> updated");
  }

  console.log("=".repeat(74));
  if (APPLY) {
    console.log(`Scanned ${scanned} rows; updated ${changed - deactivated}, deactivated ${deactivated} as duplicates.`);
  } else {
    console.log(`DRY RUN — scanned ${scanned} rows; ${changed} would change. Re-run with --apply to write.`);
  }
} finally {
  await pool.end();
}
