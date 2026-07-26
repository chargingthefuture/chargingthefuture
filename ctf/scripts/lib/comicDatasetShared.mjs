// Shared helpers for the comic seed-dataset parsers (issue #504):
// parseQuoraExportToComicDataset.mjs and parseWikiToComicDataset.mjs.

// Handles that are app vocabulary or documentation placeholders, not a person.
// Everything else matching @handle is treated as somebody's account name.
const SAFE_HANDLES = new Set(["comic", "username", "user", "here", "everyone", "channel"]);

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
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]")
    .replace(/https?:\/\/signal\.group\/\S+/g, "[signal link removed]")
    .replace(/\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b/g, "[wallet removed]")
    .replace(/\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g, "[wallet removed]")
    // Quora profile links, with or without a scheme/host, including the
    // trailing post slug and any query string.
    .replace(
      /(?:https?:\/\/)?(?:www\.)?quora\.com\/profile\/[^\s")\]]*/gi,
      "[profile link removed]",
    )
    // @handles naming an account, excluding app vocabulary and placeholders.
    .replace(/(^|[^\w@/])@([A-Za-z][\w.-]{2,})/g, (full, lead, handle) =>
      SAFE_HANDLES.has(handle.replace(/[.\-_]+$/, "").toLowerCase())
        ? full
        : `${lead}[handle removed]`,
    )
    .replace(/\+?\d[\d\s().-]{8,}\d/g, (m) =>
      // Keep plain numbers like years/amounts; redact only phone-shaped runs.
      /[\s().-]/.test(m) ? "[number removed]" : m,
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
