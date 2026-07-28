#!/usr/bin/env node
// Parse the EDITED Quora Markdown repo (the per-post .md files the owner copy-edits
// for correctness) into a JSONL seed dataset for the @comic retrieval knowledge base
// (issue #504). This is the counterpart to parseQuoraExportToComicDataset.mjs, which
// reads Quora's raw index.html export; this one reads the owner's corrected Markdown so
// the edits — not the original export — are what grounds the bot.
//
// Usage:
//   node ctf/scripts/parseQuoraMarkdownToComicDataset.mjs <account-dir> [<account-dir> ...] > out.jsonl
//
// Each <account-dir> is one Quora account's folder in the quora repo (e.g. the
// `pedigree101` directory), containing the section subfolders:
//   answers/ answer-drafts/ spaces-posts/ answer-comments/ post-comments/ question-comments/
//
// Each .md file is a header (a `>` blockquote of "**Label:** value" fields) then a
// `---` divider then the edited body. The script emits one JSON object per line, in the
// same shape importComicKnowledge.mjs already consumes, PLUS a stable `source_ref`:
//   { type: "answer",  question, answer,  created, source, source_ref }
//   { type: "post",    space, content,    created, source, source_ref }
//   { type: "comment", content,           created, source, source_ref }
//
// source_ref = "quora:<account>/<section>/<index>" (the numeric filename prefix, minus
// the slug tail). It stays constant when the body is edited or the slug is renamed, so a
// re-import UPDATES the existing knowledge row in place instead of leaving two versions
// active. That is the identity the importer's upsert keys on.
//
// The same mechanical redaction pass as the HTML parser runs on every body (emails,
// phone-shaped runs, wallet addresses, Signal/Quora profile links, other URLs, @handles).
// This is NOT full de-identification: issue #504 still requires a human curation read
// before training or public storage, because prose can carry names/locations/abuse
// details no regex catches. The owner's copy-editing pass is that read.
//
// Answer Drafts (answer-drafts/) ARE included (owner decision, 2026-07-28) — unlike the
// HTML parser, which skips unpublished drafts. The owner curates the repo by hand, so a
// draft present in the repo is one they chose to keep.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { redact } from "./lib/comicDatasetShared.mjs";

// Section folder -> record type. Comment folders all map to "comment"; both answer folders
// map to "answer" (question + body); spaces-posts maps to "post".
const SECTION_TYPE = {
  answers: "answer",
  "answer-drafts": "answer",
  "spaces-posts": "post",
  "answer-comments": "comment",
  "post-comments": "comment",
  "question-comments": "comment",
};

// Split a file into its header (leading `>` blockquote lines) and body (everything after
// the first standalone `---` divider). Returns { header, body }.
function splitDoc(raw) {
  const lines = raw.split(/\r?\n/);
  let divider = lines.findIndex((l) => l.trim() === "---");
  if (divider === -1) divider = lines.length;
  const header = lines.slice(0, divider).join("\n");
  const body = lines
    .slice(divider + 1)
    .join("\n")
    .trim();
  return { header, body };
}

// Pull "**Label:** value" out of the header. Fields are separated by `·` or newlines, so a
// value runs up to the next `·`, the next `**`, or end of line. Returns "" when absent.
function headerField(header, label) {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^·\\n]*?)(?=\\s*·|\\s*\\*\\*|$)`, "im");
  const m = header.match(re);
  return m ? m[1].trim() : "";
}

// Node's Date can't parse a trailing timezone abbreviation like "PDT"; drop it so the
// importer gets a parseable string (it still tolerates an unparseable one -> null).
function cleanCreated(value) {
  return value.replace(/\s+[A-Z]{2,4}$/, "").trim();
}

// Numeric filename prefix ("0176-who-is..." -> "0176"); falls back to the name minus
// extension when a file has no numeric prefix.
function fileIndex(fileName) {
  const m = fileName.match(/^(\d+)/);
  return m ? m[1] : fileName.replace(/\.md$/i, "");
}

function parseSection(accountName, section, dir) {
  const type = SECTION_TYPE[section];
  const records = [];
  for (const fileName of readdirSync(dir).sort()) {
    if (!fileName.toLowerCase().endsWith(".md")) continue;
    const raw = readFileSync(join(dir, fileName), "utf8");
    const { header, body } = splitDoc(raw);
    if (!body) continue;
    const created = cleanCreated(headerField(header, "Created") || headerField(header, "Time"));
    const sourceRef = `quora:${accountName}/${section}/${fileIndex(fileName)}`;
    if (type === "answer") {
      const question = redact(headerField(header, "Question"));
      const answer = redact(body);
      if (question && answer) {
        records.push({
          type,
          question,
          answer,
          created,
          source: "quora_export",
          source_ref: sourceRef,
        });
      }
    } else if (type === "post") {
      const space = headerField(header, "Space name") || headerField(header, "Space");
      const content = redact(body);
      if (content) {
        records.push({
          type,
          space,
          content,
          created,
          source: "quora_export",
          source_ref: sourceRef,
        });
      }
    } else {
      const content = redact(body);
      if (content) {
        records.push({ type, content, created, source: "quora_export", source_ref: sourceRef });
      }
    }
  }
  return records;
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error("Usage: node parseQuoraMarkdownToComicDataset.mjs <account-dir> [...]");
  process.exit(1);
}

const all = [];
for (const root of roots) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`Skipping ${root}: not a directory`);
    continue;
  }
  const accountName = basename(root.replace(/[/\\]+$/, ""));
  for (const section of Object.keys(SECTION_TYPE)) {
    const dir = join(root, section);
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      all.push(...parseSection(accountName, section, dir));
    }
  }
}

// Guard against a duplicate source_ref (should never happen within one repo); the identity
// is the file, so records are NOT deduped by content — two posts may legitimately share text.
const seen = new Set();
const counts = {};
let dupes = 0;
for (const rec of all) {
  if (seen.has(rec.source_ref)) {
    dupes++;
    continue;
  }
  seen.add(rec.source_ref);
  counts[rec.type] = (counts[rec.type] || 0) + 1;
  process.stdout.write(JSON.stringify(rec) + "\n");
}
console.error(
  `Emitted ${seen.size} records (${JSON.stringify(counts)}), skipped ${dupes} duplicate source_ref.`,
);
