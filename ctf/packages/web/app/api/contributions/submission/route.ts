import { NextResponse } from 'next/server';
import {
  auditBestEffort,
  contributionsErrorResponse,
  ensureMutationCsrf,
  parseJsonObject,
  requireContributionsUserAccess,
} from '../_lib';
import {
  GIFT_CARD_MAX_USD,
  GIFT_CARD_MIN_USD,
  createSubmission,
  getContributionsConfig,
  listOwnSubmissions,
} from 'lib/contributions/repository';
import { codeEncryptionReady } from 'lib/contributions/code-crypto';

type SubmissionBody = {
  claimedAmountUsd?: number;
  code?: string;
};

// An Amazon gift card: its amount and its code. The code is sealed before it is stored and never
// returned, logged or audited.
export async function POST(request: Request) {
  const gate = await requireContributionsUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const parsed = await parseJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed.body as SubmissionBody;

  try {
    const submission = await createSubmission({
      userId: gate.auth.userId,
      claimedAmountUsd: body.claimedAmountUsd as number,
      code: typeof body.code === 'string' ? body.code : '',
    });

    await auditBestEffort('submission_create', {
      actorUserId: gate.auth.userId,
      action: 'contributions.submission.create',
      targetSubmissionId: submission.id,
      metadata: { kind: submission.kind, method: submission.method, claimedAmountUsd: submission.claimedAmountUsd },
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution submission unavailable.', 'submission_create');
  }
}

// The member's own claims, and what the form needs: whether gift cards are being taken, the amount
// range, and how many thank-you credits a dollar brings.
export async function GET() {
  const gate = await requireContributionsUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [submissions, config] = await Promise.all([listOwnSubmissions(gate.auth.userId), getContributionsConfig()]);
    return NextResponse.json({
      ok: true,
      submissions,
      open: codeEncryptionReady(),
      minUsd: GIFT_CARD_MIN_USD,
      maxUsd: GIFT_CARD_MAX_USD,
      creditsPerUsd: config.creditsPerUsd,
    });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution history unavailable.', 'submission_list_own');
  }
}
