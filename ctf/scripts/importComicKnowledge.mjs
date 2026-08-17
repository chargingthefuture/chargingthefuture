#!/usr/bin/env node
/*
 * importComicKnowledge — load seed JSONL records (from
 * parseQuoraExportToComicDataset.mjs / parseWikiToComicDataset.mjs) into the
 * comic_knowledge_entries retrieval knowledge base (issue #504).
 *
 * Usage:
 *   DATABASE_URL=<conn> node ctf/scripts/importComicKnowledge.mjs <file.jsonl> [<file.jsonl> ...]
 *
 * Idempotent, two ways depending on the record:
 *   - Records WITH a stable `source_ref` (from parseQuoraMarkdownToComicDataset.mjs — the
 *     edited Markdown repo) UPSERT on that id: a first run inserts, and a later run of an
 *     edited file UPDATES the same row in place (new content + content_hash, updated_at set)
 *     so a corrected post never leaves a second, out-of-date copy behind.
 *   - Records WITHOUT a source_ref (from parseQuoraExportToComicDataset.mjs — the raw HTML
 *     export) keep the original behaviour: keyed by content hash, re-running inserts nothing
 *     twice.
 * Rows are imported with active = TRUE; retiring an entry is a curation step done in the
 * database by setting active = FALSE (this script never deactivates rows — add/update only).
 */

import { readFileSync } from "node:fs";
import pg from "pg";
import { contentHashOf } from "./lib/comicDatasetShared.mjs";

const { Pool } = pg;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node importComicKnowledge.mjs <file.jsonl> [...]");
  process.exit(1);
}

const VALID_TYPES = new Set(["answer", "post", "comment", "submission", "wiki"]);

function toEntry(rec) {
  if (!rec || !VALID_TYPES.has(rec.type)) return null;
  const content = rec.type === "answer" ? rec.answer : rec.content;
  if (!content || !content.trim()) return null;
  const question = rec.type === "answer" ? rec.question || null : null;
  const title = rec.title || rec.space || null;
  const source = rec.source === "github_wiki" ? "github_wiki" : "quora_export";
  const authoredAt = rec.created ? new Date(rec.created) : null;
  return {
    source,
    entryType: rec.type,
    title,
    question,
    content: content.trim(),
    contentHash: contentHashOf(rec.type, question, content),
    sourceRef:
      typeof rec.source_ref === "string" && rec.source_ref.trim() ? rec.source_ref.trim() : null,
    authoredAt: authoredAt && !Number.isNaN(authoredAt.getTime()) ? authoredAt.toISOString() : null,
  };
}

const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });

let inserted = 0;
let updated = 0;
let skipped = 0;
let invalid = 0;

try {
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        // no-trace: the line is counted as invalid and the count is printed in the summary.
        invalid++;
        continue;
      }
      const entry = toEntry(rec);
      if (!entry) {
        invalid++;
        continue;
      }
      if (entry.sourceRef) {
        // Stable-identity upsert: insert on first sight, update in place when the edited
        // file's content changed. `xmax = 0` is true only for a freshly inserted row, so it
        // tells an insert apart from an update; the WHERE on the update skips unchanged rows
        // (they report neither inserted nor updated). Retiring is a separate curation step —
        // this never sets active = FALSE.
        const result = await pool.query(
          `
            INSERT INTO comic_knowledge_entries
              (source, entry_type, title, question, content, content_hash, source_ref, authored_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (source_ref) WHERE source_ref IS NOT NULL DO UPDATE SET
              source = EXCLUDED.source,
              entry_type = EXCLUDED.entry_type,
              title = EXCLUDED.title,
              question = EXCLUDED.question,
              content = EXCLUDED.content,
              content_hash = EXCLUDED.content_hash,
              authored_at = EXCLUDED.authored_at,
              updated_at = NOW()
            WHERE comic_knowledge_entries.content_hash IS DISTINCT FROM EXCLUDED.content_hash
            RETURNING (xmax = 0) AS inserted
          `,
          [
            entry.source,
            entry.entryType,
            entry.title,
            entry.question,
            entry.content,
            entry.contentHash,
            entry.sourceRef,
            entry.authoredAt,
          ],
        );
        if (result.rowCount === 0) skipped++;
        else if (result.rows[0].inserted) inserted++;
        else updated++;
      } else {
        // Legacy raw-HTML-export path: dedupe on content hash, insert-or-nothing.
        const result = await pool.query(
          `
            INSERT INTO comic_knowledge_entries (source, entry_type, title, question, content, content_hash, authored_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (content_hash) WHERE source_ref IS NULL DO NOTHING
          `,
          [
            entry.source,
            entry.entryType,
            entry.title,
            entry.question,
            entry.content,
            entry.contentHash,
            entry.authoredAt,
          ],
        );
        if (result.rowCount === 1) inserted++;
        else skipped++;
      }
    }
  }
  console.log(
    `Imported ${inserted} new, updated ${updated} edited, ${skipped} unchanged/already present, ${invalid} invalid lines skipped.`,
  );
} finally {
  await pool.end();
}
