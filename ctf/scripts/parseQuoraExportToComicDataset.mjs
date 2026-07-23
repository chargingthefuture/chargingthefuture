#!/usr/bin/env node
// Parse a Quora content export (index.html files) into a JSONL seed dataset
// for the @comic retrieval knowledge base / fine-tuning pipeline (issue #504).
//
// Usage:
//   node ctf/scripts/parseQuoraExportToComicDataset.mjs <export-dir> [<export-dir> ...] > out.jsonl
//
// Each <export-dir> is an unzipped Quora "content" export containing an
// index.html. The script emits one JSON object per line:
//   { type: "answer",     question, answer, created, source }
//   { type: "post",       space, url, content, created, source }
//   { type: "comment",    content, created, source }
//   { type: "submission", space, content, created, source }
//
// Included sections: Answers, Spaces Items, Answer/Question/Post Comments,
// and Space Submissions (the owner's questions and posts submitted to other
// spaces) — all public content authored by the account owner.
// Excluded sections: Inbox Messages (private correspondence), Answer Drafts
// (unpublished), profile data.
//
// A mechanical redaction pass removes emails, phone-number-like strings,
// Signal group links, and cryptocurrency wallet addresses. This is NOT full
// de-identification: issue #504 requires a manual curation step before any
// training or public storage, because free text can carry locations,
// identities, and abuse details no regex can catch.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { redact, emitDeduped } from "./lib/comicDatasetShared.mjs";

const INCLUDED_SECTIONS = new Set([
  "Answers",
  "Spaces Items",
  "Answer Comments",
  "Question Comments",
  "Post Comments",
  "Space Submissions",
]);

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<br[^>]*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Pull "<strong>Label: </strong><span ...>value</span>"-style fields out of an
// item block. Values may be a bare <span> or a rendered_qtext span with markup.
function field(block, label) {
  const re = new RegExp(
    `<strong>${label}:\\s*</strong>\\s*<span[^>]*>([\\s\\S]*?)</span>\\s*</div>`,
    "i",
  );
  const m = block.match(re);
  return m ? stripTags(m[1]) : "";
}

function parseFile(html) {
  const records = [];
  // Split the document into H1 sections, then each section into H2 items.
  const sections = html.split(/<h1[^>]*>/).slice(1);
  for (const section of sections) {
    const nameMatch = section.match(/^([^<]+)<\/h1>/);
    const sectionName = nameMatch ? nameMatch[1].trim() : "";
    if (!INCLUDED_SECTIONS.has(sectionName)) continue;
    const items = section.split(/<h2[^>]*>/).slice(1);
    for (const item of items) {
      const created = field(item, "Creation time") || field(item, "Time");
      if (sectionName === "Space Submissions") {
        // The owner's questions and posts submitted to other spaces. An item
        // carries either a "Question" field or "Post title"/"Post content".
        const space = field(item, "Space name");
        const content = redact(
          [field(item, "Question"), field(item, "Post title"), field(item, "Post content")]
            .filter(Boolean)
            .join("\n"),
        );
        if (content) {
          records.push({ type: "submission", space, content, created, source: "quora_export" });
        }
      } else if (sectionName === "Answers") {
        const question = redact(field(item, "Question"));
        const answer = redact(field(item, "Content"));
        if (question && answer) {
          records.push({ type: "answer", question, answer, created, source: "quora_export" });
        }
      } else if (sectionName === "Spaces Items") {
        const deleted = field(item, "Deleted").toLowerCase();
        if (deleted === "yes") continue;
        const space = field(item, "Space name");
        const url = field(item, "Share url");
        const content = redact(field(item, "Post content"));
        if (content) {
          records.push({ type: "post", space, url, content, created, source: "quora_export" });
        }
      } else {
        const content = redact(
          field(item, "Comment content") ||
            field(item, "Post CommentContent") ||
            field(item, "Content"),
        );
        if (content) {
          records.push({ type: "comment", content, created, source: "quora_export" });
        }
      }
    }
  }
  return records;
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("Usage: node parseQuoraExportToComicDataset.mjs <export-dir> [...]");
  process.exit(1);
}

const all = [];
for (const dir of dirs) {
  const file = join(dir, "index.html");
  if (!existsSync(file)) {
    console.error(`Skipping ${dir}: no index.html`);
    continue;
  }
  all.push(...parseFile(readFileSync(file, "utf8")));
}

// Drop exact duplicates (recruiting boilerplate repeats across posts).
const { emitted, dupes, counts } = emitDeduped(
  all,
  (rec) => rec.type + "\u0000" + (rec.question || "") + "\u0000" + (rec.answer || rec.content),
);
console.error(
  `Emitted ${emitted} records (${JSON.stringify(counts)}), dropped ${dupes} exact duplicates.`,
);
