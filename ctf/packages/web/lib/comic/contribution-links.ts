import { redactContributedText } from './redact';
import type { ContributedEntry } from './quora-export-intake';

// The DEFAULT contribution path: a member pastes the two or three posts that are actually about
// being targeted, rather than handing over their whole account.
//
// Why this is the default and the export is the fallback: most people's public writing is mixed —
// dating, politics, faith, memes, and somewhere in there the posts that would genuinely help another
// survivor. Nothing in this pipeline sorts those automatically; there is no classifier, and an entry
// only ever reaches the assistant because a person put it there. So with an export, the reviewer
// reads hundreds of posts to find a handful. The author can pick the same handful out in seconds,
// because they already know which ones they are.
//
// It is also the more honest consent. Choosing three posts is knowing exactly what you are giving.
// Uploading an archive is agreeing in bulk to things you have forgotten you wrote.
//
// NOTHING HERE FETCHES THE LINK. The URL is provenance — it lets a reviewer confirm the post is
// public and belongs to the contributor — and the member supplies the text themselves. Scraping
// would inherit the exact fragility that got links stripped from the corpus in the first place: a
// post deleted or edited between paste and read would leave an entry nobody could verify.

export const MAX_LINKED_POSTS = 20;
export const MIN_POST_LENGTH = 120;
export const MAX_POST_LENGTH = 20000;

export type LinkedPostInput = {
  url: string;
  text: string;
};

export type LinkedPostValidation =
  | { ok: true; entries: ContributedEntry[] }
  | { ok: false; message: string };

// Accept only a Quora post/answer URL. Narrow on purpose: the point of the link is that a reviewer
// can open it and check the post is public and the contributor's, which only works for a site whose
// pages we can actually read.
function isAcceptableSourceUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  return host === 'quora.com' || host.endsWith('.quora.com');
}

type SinglePostValidation =
  | { ok: true; entry: ContributedEntry }
  | { ok: false; message: string };

// Validate one pasted post at its 1-based position. Records the accepted URL in `seenUrls` so a
// later post reusing the same link is caught. Kept separate from the loop so each function stays
// within the complexity budget; the checks run in the same order as before.
function validateSinglePost(raw: unknown, position: number, seenUrls: Set<string>): SinglePostValidation {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: `Post ${position} is missing.` };
  }
  const { url, text } = raw as Partial<LinkedPostInput>;

  if (typeof url !== 'string' || !isAcceptableSourceUrl(url)) {
    return { ok: false, message: `Post ${position} needs a link to the post on Quora.` };
  }
  const normalizedUrl = url.trim();
  if (seenUrls.has(normalizedUrl)) {
    return { ok: false, message: `Post ${position} is the same link as an earlier one.` };
  }
  seenUrls.add(normalizedUrl);

  if (typeof text !== 'string') {
    return { ok: false, message: `Post ${position} is missing its text.` };
  }
  const trimmed = text.trim();
  if (trimmed.length < MIN_POST_LENGTH) {
    // Not a quality judgement — a couple of lines cannot ground an answer to anything, and the
    // reviewer would only discard it. Saying so now saves the contributor the wait.
    return {
      ok: false,
      message: `Post ${position} is very short. Paste the whole post — a line or two is not enough for the assistant to answer from.`,
    };
  }
  if (trimmed.length > MAX_POST_LENGTH) {
    return { ok: false, message: `Post ${position} is longer than a single Quora post. Paste one post per box.` };
  }

  // The same redaction the export path applies: contact details out, links out. The source URL is
  // kept separately as provenance rather than left inside the text, where the redactor would strip
  // it and the reviewer would lose the ability to check the post.
  return {
    ok: true,
    entry: {
      entryType: 'post',
      question: null,
      content: redactContributedText(trimmed),
      createdRaw: null,
      sourceUrl: normalizedUrl,
    },
  };
}

export function validateLinkedPosts(rawPosts: unknown): LinkedPostValidation {
  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    return { ok: false, message: 'Add at least one post.' };
  }
  if (rawPosts.length > MAX_LINKED_POSTS) {
    return { ok: false, message: `That is more than ${MAX_LINKED_POSTS} posts. Send them in a couple of goes.` };
  }

  const entries: ContributedEntry[] = [];
  const seenUrls = new Set<string>();

  for (const [index, raw] of rawPosts.entries()) {
    const result = validateSinglePost(raw, index + 1, seenUrls);
    if (!result.ok) {
      return result;
    }
    entries.push(result.entry);
  }

  return { ok: true, entries };
}
