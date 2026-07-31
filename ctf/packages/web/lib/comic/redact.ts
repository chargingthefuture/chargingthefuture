// Mechanical redaction for contributed Quora content.
//
// This is the TypeScript twin of `ctf/scripts/lib/comicDatasetShared.mjs`, which the one-time seed
// parsers use. The two exist separately because a `.mjs` operational script cannot import from the
// web package's TypeScript — KEEP THEM IN STEP. (The script side is scheduled for deletion once the
// one-time imports finish, at which point this becomes the only copy.)
//
// What it removes and why:
//   - emails, phone-shaped number runs, Signal group links, wallet addresses — direct contact
//     details for a person.
//   - Quora profile links and @handles — these name a PERSON. In a community whose whole purpose is
//     keeping targeted individuals from being identified, a link carrying both someone's identity
//     and what they wrote is the most sensitive thing in an export.
//   - every other URL — on ACCURACY grounds (owner decision, 2026-07-26), not privacy. Links are the
//     most perishable part of the corpus and the part the bot would be most confidently wrong about:
//     a quarter of the first seed's links were already truncated by Quora's own exporter, old app
//     deep links point at routes that no longer exist, and a link to another member's account can rot
//     in the worst way — deleted, or taken over. A bot answer that sends a survivor to a compromised
//     account is not merely out of date, it is a safety failure.
//
// This is NOT de-identification and must not be described as such. Free text carries names,
// locations, and abuse details that no pattern can catch. Redaction narrows exposure; it does not
// remove the need for a human to read every contribution before it is used.

// Handles that are app vocabulary or documentation placeholders, not a person.
const SAFE_HANDLES = new Set(['comic', 'username', 'user', 'here', 'everyone', 'channel']);

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

export function redactContributedText(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
    .replace(/https?:\/\/signal\.group\/\S+/g, '[signal link removed]')
    .replace(/\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b/g, '[wallet removed]')
    .replace(/\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g, '[wallet removed]')
    // Quora profile links, with or without a scheme/host, including the trailing post slug. Handled
    // before the general URL rule so a profile link is labeled as such rather than as a bare link.
    .replace(/(?:https?:\/\/)?(?:www\.)?quora\.com\/profile\/[^\s")\]]*/gi, '[profile link removed]')
    .replace(URL_PATTERN, '[link removed]')
    .replace(/(^|[^\w@/])@([A-Za-z][\w.-]{2,})/g, (full, lead: string, handle: string) =>
      SAFE_HANDLES.has(handle.replace(/[.\-_]+$/, '').toLowerCase()) ? full : `${lead}[handle removed]`,
    )
    .replace(/\+?\d[\d\s().-]{8,}\d/g, (match) =>
      // Keep plain numbers like years and amounts; redact only phone-shaped runs.
      /[\s().-]/.test(match) ? '[number removed]' : match,
    );
}
