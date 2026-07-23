// Shared helpers for the comic seed-dataset parsers (issue #504):
// parseQuoraExportToComicDataset.mjs and parseWikiToComicDataset.mjs.

// Mechanical redaction: emails, Signal group links, wallet addresses, and
// phone-shaped number runs. This is NOT full de-identification — issue #504
// requires a manual curation step before any training or public storage,
// because free text can carry locations, identities, and abuse details no
// regex can catch.
export function redact(text) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]")
    .replace(/https?:\/\/signal\.group\/\S+/g, "[signal link removed]")
    .replace(/\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b/g, "[wallet removed]")
    .replace(/\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g, "[wallet removed]")
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
