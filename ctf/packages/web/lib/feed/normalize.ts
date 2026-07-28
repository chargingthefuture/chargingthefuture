// Client-safe copy of the text normalization the feed applies before storing and before measuring
// length. It lives here, apart from lib/feed/repository.ts, because the repository imports the
// database client and cannot be pulled into a browser bundle — and the composer's character counter
// must measure exactly what the server will measure, or it lies to the member.
//
// What it does, in order: normalize CRLF/CR to LF; collapse runs of horizontal whitespace inside
// each line to one space and trim the line; collapse three-or-more blank lines to one blank line;
// trim the whole thing.
//
// Why the counter cannot just use `value.length`: a member who indents, double-spaces after periods,
// or leaves a run of blank lines is measured on the collapsed text. Counting raw characters would
// report them over the limit while the server happily accepts the post.
export function normalizeMultilineText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// The length the server will check a Commons post against.
export function feedPostLength(value: string): number {
  return normalizeMultilineText(value).length;
}
