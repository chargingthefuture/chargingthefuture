// Shared helpers for the comic seed-dataset scripts (issue #504): the parsers
// (parseQuoraExportToComicDataset.mjs, parseQuoraMarkdownToComicDataset.mjs,
// parseWikiToComicDataset.mjs) and the importer.

import { createHash } from "node:crypto";

// THE canonical comic_knowledge_entries.content_hash formula. The hash is what stops the same
// writing being stored twice, so every place that writes one must agree on it: the importer
// (importComicKnowledge.mjs) and — across the package boundary, which cannot import this file — the
// member-contribution accept path (packages/web/app/api/comic/admin/contributions/[id]/review/
// route.ts). Change the formula here and that route must change in the same commit.
//
// The separator is NUL, written as the escape rather than a literal NUL byte so this file stays
// plain text: a raw NUL makes git treat a source file as binary and print "Binary files differ"
// instead of a reviewable diff. The runtime string — and therefore every hash — is identical.
//
// NUL is also the right separator on its own merits: it cannot occur in the text being hashed, so
// ("post", "a b", "c") and ("post", "a", "b c") cannot collide the way a space-joined key can.
//
// History: the now-removed identifier scrub (scrubComicKnowledgeIdentifiers.mjs, deleted in #1954
// after its production run) joined these fields with a SPACE while the importer used NUL. Rows that
// scrub rewrote therefore hold a hash the importer will not reproduce, so they will not dedupe
// against a re-import until they are recomputed — a production data pass, tracked separately.
export function contentHashOf(entryType, question, content) {
  return createHash("sha256")
    .update(entryType + "\u0000" + (question || "") + "\u0000" + content.trim())
    .digest("hex");
}

// Handles that are app vocabulary or documentation placeholders, not a person.
// Everything else matching @handle is treated as somebody's account name.
const SAFE_HANDLES = new Set(["comic", "username", "user", "here", "everyone", "channel"]);

// URLs are stripped from the seed corpus on ACCURACY grounds (owner decision, 2026-07-26), not
// privacy. The seed's value is the writing — what good help looks like and what the community
// knows — not a link directory. Links are the most perishable part of it and the part the bot
// would be most confidently wrong about:
//   - 24% of seed records carry a URL the Quora export itself truncated with "..." — already
//     unusable, and unfixable from this data.
//   - Old app deep links point at routes that no longer exist (e.g. /apps/directory/public/<id>;
//     the Directory's public projection was removed 2026-05-18 and legacy URLs are deliberately
//     not redirected).
//   - Links to another member's account can rot in the worst way: the account may be deleted, or
//     taken over. A bot answer that sends a survivor to a compromised account is not merely
//     out-of-date, it is a safety failure.
// The prose keeps naming people and places ("Nat Morris created a list of questions…"), so
// attribution and meaning survive; only the fragile pointer goes. The bot should tell a member to
// open LightHouse, not hand them a URL it cannot vouch for.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

// Mechanical redaction: emails, Signal group links, wallet addresses,
// phone-shaped number runs, Quora profile links, and @handles.
//
// Quora profile URLs and @handles are redacted because they name a PERSON: a
// link like quora.com/profile/<Name>/<their-post-slug> carries both a member's
// identity and what they wrote — in a community whose whole purpose is keeping
// targeted individuals from being identified, that is the most sensitive thing
// in an export. The slug is dropped with the URL for the same reason.
//
// This is still NOT full de-identification — issue #504 requires a manual
// curation step before any training or public storage, because free text can
// carry names, locations, and abuse details written in prose that no regex can
// catch. Redaction narrows the exposure; it does not remove the need to read.
export function redact(text) {
  return (
    text
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]")
      .replace(/https?:\/\/signal\.group\/\S+/g, "[signal link removed]")
      .replace(/\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b/g, "[wallet removed]")
      .replace(/\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g, "[wallet removed]")
      // Quora profile links, with or without a scheme/host, including the
      // trailing post slug and any query string. Handled before the general URL
      // rule so a profile link is labeled as such rather than as a bare link.
      .replace(
        /(?:https?:\/\/)?(?:www\.)?quora\.com\/profile\/[^\s")\]]*/gi,
        "[profile link removed]",
      )
      // Every other URL — see URL_PATTERN's note: perishable, and the bot must not
      // emit a link it cannot vouch for.
      .replace(URL_PATTERN, "[link removed]")
      // @handles naming an account, excluding app vocabulary and placeholders.
      .replace(/(^|[^\w@/])@([A-Za-z][\w.-]{2,})/g, (full, lead, handle) =>
        SAFE_HANDLES.has(handle.replace(/[.\-_]+$/, "").toLowerCase())
          ? full
          : `${lead}[handle removed]`,
      )
      .replace(/\+?\d[\d\s().-]{8,}\d/g, (m) =>
        // Keep plain numbers like years/amounts; redact only phone-shaped runs.
        /[\s().-]/.test(m) ? "[number removed]" : m,
      )
  );
}

// Emit records as JSONL to stdout, dropping exact duplicates by a caller-built
// key. Returns { emitted, dupes, counts } for the caller's summary line.
export function emitDeduped(records, keyOf) {
  const seen = new Set();
  const counts = {};
  let dupes = 0;
  for (const rec of records) {
    const key = keyOf(rec);
    if (seen.has(key)) {
      dupes++;
      continue;
    }
    seen.add(key);
    counts[rec.type] = (counts[rec.type] || 0) + 1;
    process.stdout.write(JSON.stringify(rec) + "\n");
  }
  return { emitted: seen.size, dupes, counts };
}
