import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicContributionAccess } from '../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { readQuoraExportArchive } from 'lib/comic/contribution-archive';
import { dedupeContributedEntries, parseQuoraExportHtml } from 'lib/comic/quora-export-intake';
import type { ContributedEntry } from 'lib/comic/quora-export-intake';
import {
  CONTRIBUTION_CONSENT_VERSION,
  hasAgreedToEveryClause,
} from 'lib/comic/contribution-consent';
import {
  countRecentContributions,
  createContribution,
  listContributionsForUser,
} from 'lib/comic/contribution-repository';
import { validateLinkedPosts } from 'lib/comic/contribution-links';
import { linkContributionToUnlock } from 'lib/comic/contribution-unlock-link';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// A Quora export zip is compressed HTML; even a heavy account lands far under this. The cap is the
// first line of defense and is enforced before a single byte is decompressed.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Parsing an archive costs real memory, so a signed-in account cannot do it in a loop.
const MAX_CONTRIBUTIONS_PER_DAY = 5;

function badRequest(message: string, code: string = COMIC_ERROR_CODE.invalidPayload) {
  return NextResponse.json({ ok: false, code, message }, { status: 400 });
}

// A parsed submission ready to store, or the 400 to return instead.
type IntakeResult = { error: NextResponse } | { entries: ContributedEntry[]; discarded: string[] };

// A request validated up to (but not including) the rate-limit check and content intake.
type PreparedContribution =
  | { error: NextResponse }
  | { form: FormData; kind: 'links' | 'export'; file: File | null };

// Consent is checked first, on purpose: an upload without it is never parsed, so a member who did
// not agree has their file ignored rather than processed and then rejected. Returns the 400 to send,
// or null when consent is in order.
function checkConsent(form: FormData): NextResponse | null {
  let agreedClauseIds: unknown;
  try {
    agreedClauseIds = JSON.parse(String(form.get('agreedClauseIds') ?? '[]'));
  } catch {
    agreedClauseIds = null;
  }
  if (!hasAgreedToEveryClause(agreedClauseIds)) {
    return badRequest('Every consent statement has to be agreed to before anything can be sent.');
  }
  // A page cached from before a consent change would submit the old clause ids. Those pass the check
  // above only if the ids still match; a version mismatch means the member read different wording,
  // so make them re-read it rather than record consent they never gave.
  if (String(form.get('consentVersion') ?? '') !== CONTRIBUTION_CONSENT_VERSION) {
    return badRequest(
      'The consent wording has been updated. Reload this page and read it again before sending.',
      COMIC_ERROR_CODE.conflict,
    );
  }
  return null;
}

// The file is only required on the export path. Validate its presence and size before anything is
// decompressed.
function validateUpload(form: FormData): { error: NextResponse } | { file: File } {
  const uploaded = form.get('archive');
  if (!(uploaded instanceof File)) {
    return { error: badRequest('Attach the .zip file Quora sent you.') };
  }
  if (uploaded.size === 0) return { error: badRequest('That file is empty.') };
  if (uploaded.size > MAX_UPLOAD_BYTES) {
    return { error: badRequest(`That file is larger than ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`) };
  }
  return { file: uploaded };
}

// Parse the request up to the file: form body, chosen path, consent, and (export only) upload
// validation. Kept before the rate-limit check so a malformed upload still 400s rather than 429s.
async function prepareContribution(request: Request): Promise<PreparedContribution> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { error: badRequest('Could not read what you sent.') };
  }

  // Two paths, and the default is the smaller one. `links` — the member pastes the two or three
  // posts that are actually about being targeted, each with its Quora link as provenance. Most
  // people's writing is mixed (dating, politics, faith, memes), and NOTHING in this pipeline sorts
  // on-topic from off-topic automatically, so this puts the choosing where it is instant and free:
  // with the author, who already knows which posts they are. It is also the more honest consent —
  // picking three posts is knowing exactly what you are giving, where handing over an archive is
  // agreeing in bulk to things you have forgotten you wrote.
  // `export` stays for the rarer member whose public writing is nearly all on-topic.
  const kind = form.get('kind') === 'export' ? 'export' : 'links';

  const consentDeny = checkConsent(form);
  if (consentDeny) return { error: consentDeny };

  // A links contribution carries no upload at all, which is most of why it is the safer default: no
  // archive to parse, and nothing to attack.
  let file: File | null = null;
  if (kind === 'export') {
    const upload = validateUpload(form);
    if ('error' in upload) return { error: upload.error };
    file = upload.file;
  }

  return { form, kind, file };
}

// Links path: parse the pasted posts and validate them.
function intakeLinks(form: FormData): IntakeResult {
  let posts: unknown;
  try {
    posts = JSON.parse(String(form.get('posts') ?? '[]'));
  } catch {
    return { error: badRequest('Could not read the posts you pasted.') };
  }
  const validated = validateLinkedPosts(posts);
  if (!validated.ok) return { error: badRequest(validated.message) };
  return { entries: validated.entries, discarded: [] };
}

// Export path: parse the archive in memory, keep the allowlisted public sections, and discard the
// rest (inbox, drafts, profile) before anything is written or any human sees it.
async function intakeExport(file: File): Promise<IntakeResult> {
  const archive = readQuoraExportArchive(new Uint8Array(await file.arrayBuffer()));
  if (!archive.ok) {
    const message =
      archive.reason === 'not_a_zip'
        ? 'That is not the .zip file Quora sends. Send the file from Quora as it arrived, without unzipping it.'
        : archive.reason === 'no_index_html'
          ? 'That .zip does not look like a Quora export — it has no index.html inside.'
          : 'That export is too large to read.';
    return { error: badRequest(message) };
  }

  const parsed = parseQuoraExportHtml(archive.html);
  if (!parsed.looksLikeQuoraExport) {
    return { error: badRequest('That file does not look like a Quora export.') };
  }

  const entries = dedupeContributedEntries(parsed.entries);
  if (entries.length === 0) {
    return { error: badRequest(
      'Nothing public was found in that export — no answers, posts, or comments. Nothing has been kept.',
    ) };
  }
  return { entries, discarded: parsed.discarded };
}

// Store the surviving entries and record the consent (never the content), then respond.
async function storeContribution(params: {
  form: FormData;
  userId: string;
  kind: 'links' | 'export';
  entries: ContributedEntry[];
  discarded: string[];
}): Promise<NextResponse> {
  const { form, userId, kind, entries, discarded } = params;

  const contribution = await createContribution({
    userId,
    kind,
    consentVersion: CONTRIBUTION_CONSENT_VERSION,
    thirdPartyNote: String(form.get('thirdPartyNote') ?? ''),
    discardedSections: discarded,
    entries,
  });

  // Contributing is a route into verification: if this member has no Quora URL on file and gave
  // one here, open an Unlock submission from it. Best-effort and AFTER the contribution is stored —
  // the writing is already safe, and a failure here just means they verify the ordinary way.
  // It creates a pending submission, never an approval; the owner still decides.
  const unlockLink = await linkContributionToUnlock({
    userId,
    quoraProfileUrl: typeof form.get('quoraProfileUrl') === 'string' ? String(form.get('quoraProfileUrl')) : null,
    contributionId: contribution.id,
  });

  // Audit the consent, never the content. What matters for the record is that this member agreed
  // to this version of the wording at this time.
  logComicAudit({
    actorId: userId,
    pluginId: 'comic',
    command: 'comic.contribution.submit',
    status: 'allow',
    reason: 'ok',
    targetType: 'contribution',
    targetId: contribution.id,
    result: 'success',
    errorCategory: null,
    metadata: {
      consentVersion: CONTRIBUTION_CONSENT_VERSION,
      entryCount: contribution.entryCount,
      kind,
      discardedSections: discarded,
      unlockLink: unlockLink.status,
    },
  });

  return NextResponse.json({ ok: true, contribution, unlockLink: unlockLink.status }, { status: 201 });
}

// GET: the member's own contribution history, for the page's status list.
export async function GET() {
  const gate = await requireComicContributionAccess();
  if (!gate.allowed) return gate.response;

  try {
    const contributions = await listContributionsForUser(gate.auth.userId);
    return NextResponse.json({ ok: true, contributions }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'contributions_list' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Could not load your contributions.' },
      { status: 503 },
    );
  }
}

// POST: accept a member's contribution and record the consent that permits using it.
//
// The order of operations here is the promise made on the contribute page, in code:
//   1. check consent BEFORE looking at the content at all — no consent, nothing is read;
//   2. for an export, parse the archive in memory, reading only index.html;
//   3. keep the allowlisted public sections and DISCARD THE REST — inbox, drafts, profile — before
//      anything is written or any human sees it;
//   4. store only what survived. The uploaded archive is never written to disk and is gone as soon
//      as this request ends.
export async function POST(request: Request) {
  const gate = await requireComicContributionAccess();
  if (!gate.allowed) return gate.response;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const prepared = await prepareContribution(request);
  if ('error' in prepared) return prepared.error;
  const { form, kind, file } = prepared;

  try {
    if ((await countRecentContributions(gate.auth.userId, 24)) >= MAX_CONTRIBUTIONS_PER_DAY) {
      return NextResponse.json(
        {
          ok: false,
          code: COMIC_ERROR_CODE.rateLimitExceeded,
          message: 'You have sent several contributions today. Try again tomorrow.',
        },
        { status: 429 },
      );
    }

    const intake = kind === 'links' ? intakeLinks(form) : await intakeExport(file as File);
    if ('error' in intake) return intake.error;

    return await storeContribution({
      form,
      userId: gate.auth.userId,
      kind,
      entries: intake.entries,
      discarded: intake.discarded,
    });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'contribution_submit' });
    return NextResponse.json(
      {
        ok: false,
        code: COMIC_ERROR_CODE.persistenceUnavailable,
        message: 'Could not store your contribution. Nothing was kept — try again.',
      },
      { status: 503 },
    );
  }
}
