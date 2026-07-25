import { NextResponse } from 'next/server';
import { requireFoundationReadAccess, ensureMutationCsrf } from 'lib/foundation/_lib';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import {
  FOUNDATION_SHORT_DESCRIPTION_MAX,
  getOwnProviderShortDescription,
  setOwnProviderShortDescription,
} from 'lib/foundation/repository';
import { reportError } from 'lib/observability/report';

// A provider's own short blurb shown on their Foundation listing before a member requests a quote.
// Read access requires Unlock (the gate enforces approved_full), so only unlocked members reach this.
export async function GET() {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const shortDescription = await getOwnProviderShortDescription(gate.auth.userId);
    return NextResponse.json({ ok: true, shortDescription, maxLength: FOUNDATION_SHORT_DESCRIPTION_MAX }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'provider_description_get' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to load your listing description.' },
      { status: 503 },
    );
  }
}

type DescriptionBody = { shortDescription?: unknown };

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message },
    { status: 400 },
  );
}

// Save the member's short listing blurb. A blank string clears it. The repository enforces the length
// cap and throws 'invalid_short_description' which maps to a clear member-facing 400.
export async function PUT(request: Request) {
  // CSRF first, then auth — the canonical mutation order across this plugin (issue #989).
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: DescriptionBody;
  try {
    body = (await request.json()) as DescriptionBody;
  } catch {
    return badRequest('Invalid JSON body.');
  }

  if (typeof body.shortDescription !== 'string') {
    return badRequest('shortDescription must be a string.');
  }

  try {
    const shortDescription = await setOwnProviderShortDescription(gate.auth.userId, body.shortDescription);
    return NextResponse.json({ ok: true, shortDescription, maxLength: FOUNDATION_SHORT_DESCRIPTION_MAX }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'invalid_short_description') {
      return badRequest(`Keep your description to ${FOUNDATION_SHORT_DESCRIPTION_MAX} characters or fewer.`);
    }
    reportError(error, { area: 'foundation', op: 'provider_description_set' });
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to save your listing description.' },
      { status: 503 },
    );
  }
}
