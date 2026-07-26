// Shared helpers for the comic seed-dataset parsers (issue #504):
// parseQuoraExportToComicDataset.mjs and parseWikiToComicDataset.mjs.

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
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]")
    .replace(/https?:\/\/signal\.group\/\S+/g, "[signal link removed]")
    .replace(/\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b/g, "[wallet removed]")
    .replace(/\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g, "[wallet removed]")
    // Quora profile links, with or without a scheme/host, including the
    // trailing post slug and any query string. Handled before the general URL
    // rule so a profile link is labelled as such rather than as a bare link.
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
