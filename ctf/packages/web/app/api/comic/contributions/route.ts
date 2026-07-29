import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicReadAccess } from '../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { readQuoraExportArchive } from 'lib/comic/contribution-archive';
import { dedupeContributedEntries, parseQuoraExportHtml } from 'lib/comic/quora-export-intake';
import {
  CONTRIBUTION_CONSENT_VERSION,
  hasAgreedToEveryClause,
} from 'lib/comic/contribution-consent';
import {
  countRecentContributions,
  createContribution,
  listContributionsForUser,
} from 'lib/comic/contribution-repository';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// A Quora export zip is compressed HTML; even a heavy account lands far under this. The cap is the
// first line of defence and is enforced before a single byte is decompressed.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Parsing an archive costs real memory, so a signed-in account cannot do it in a loop.
const MAX_CONTRIBUTIONS_PER_DAY = 5;

function badRequest(message: string, code: string = COMIC_ERROR_CODE.invalidPayload) {
  return NextResponse.json({ ok: false, code, message }, { status: 400 });
}

// GET: the member's own contribution history, for the page's status list.
export async function GET() {
  const gate = await requireComicReadAccess();
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

// POST: accept a member's Quora export, keep only their public answers and posts, and record the
// consent that permits using them.
//
// The order of operations here is the promise made on the contribute page, in code:
//   1. check consent BEFORE looking at the file at all — no consent, nothing is read;
//   2. parse the archive in memory, reading only index.html;
//   3. keep the allowlisted public sections and DISCARD THE REST — inbox, drafts, profile — before
//      anything is written or any human sees it;
//   4. store only what survived. The uploaded archive is never written to disk and is gone as soon
//      as this request ends.
export async function POST(request: Request) {
  const gate = await requireComicReadAccess();
  if (!gate.allowed) return gate.response;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest('Could not read the upload.');
  }

  // Consent is checked first, on purpose: an upload without it is never parsed, so a member who did
  // not agree has their file ignored rather than processed and then rejected.
  let agreedClauseIds: unknown;
  try {
    agreedClauseIds = JSON.parse(String(form.get('agreedClauseIds') ?? '[]'));
  } catch {
    agreedClauseIds = null;
  }
  if (!hasAgreedToEveryClause(agreedClauseIds)) {
    return badRequest('Every consent statement has to be agreed to before a file can be sent.');
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

  const file = form.get('archive');
  if (!(file instanceof File)) {
    return badRequest('Attach the .zip file Quora sent you.');
  }
  if (file.size === 0) return badRequest('That file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) {
    return badRequest(`That file is larger than ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`);
  }

  try {
    if ((await countRecentContributions(gate.auth.userId, 24)) >= MAX_CONTRIBUTIONS_PER_DAY) {
      return NextResponse.json(
        {
          ok: false,
          code: COMIC_ERROR_CODE.rateLimitExceeded,
          message: 'You have sent several files today. Try again tomorrow.',
        },
        { status: 429 },
      );
    }

    const archive = readQuoraExportArchive(new Uint8Array(await file.arrayBuffer()));
    if (!archive.ok) {
      const message =
        archive.reason === 'not_a_zip'
          ? 'That is not the .zip file Quora sends. Send the file from Quora as it arrived, without unzipping it.'
          : archive.reason === 'no_index_html'
            ? 'That .zip does not look like a Quora export — it has no index.html inside.'
            : 'That export is too large to read.';
      return badRequest(message);
    }

    const parsed = parseQuoraExportHtml(archive.html);
    if (!parsed.looksLikeQuoraExport) {
      return badRequest('That file does not look like a Quora export.');
    }

    const entries = dedupeContributedEntries(parsed.entries);
    if (entries.length === 0) {
      return badRequest(
        'Nothing public was found in that export — no answers, posts, or comments. Nothing has been kept.',
      );
    }

    const contribution = await createContribution({
      userId: gate.auth.userId,
      consentVersion: CONTRIBUTION_CONSENT_VERSION,
      thirdPartyNote: String(form.get('thirdPartyNote') ?? ''),
      discardedSections: parsed.discarded,
      entries,
    });

    // Audit the consent, never the content. What matters for the record is that this member agreed
    // to this version of the wording at this time.
    logComicAudit({
      actorId: gate.auth.userId,
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
        discardedSections: parsed.discarded,
      },
    });

    return NextResponse.json({ ok: true, contribution }, { status: 201 });
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
