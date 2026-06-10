import { NextResponse } from 'next/server';
import {
  contributionsErrorResponse,
  ensureMutationCsrf,
  requireContributionsUserAccess,
} from '../_lib';
import {
  assertNoGiftCardCodeFields,
  createSubmission,
  insertContributionsAudit,
  listOwnSubmissions,
} from 'lib/contributions/repository';
import type { ContributionKind, GiftCardMethod } from 'lib/contributions/types';

type SubmissionBody = {
  kind?: ContributionKind;
  method?: GiftCardMethod;
  claimedAmountUsd?: number;
  signalContact?: string;
  quoraPostUrl?: string;
  githubProfileUrl?: string;
};

export async function POST(request: Request) {
  const gate = await requireContributionsUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, code: 'contributions_invalid_payload', message: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    // Gift-card codes are never accepted by the platform; reject any code-like field outright.
    assertNoGiftCardCodeFields(rawBody);

    const body = rawBody as SubmissionBody;
    const submission = await createSubmission({
      userId: gate.auth.userId,
      kind: body.kind as ContributionKind,
      method: body.method,
      claimedAmountUsd: body.claimedAmountUsd,
      signalContact: body.signalContact,
      quoraPostUrl: body.quoraPostUrl,
      githubProfileUrl: body.githubProfileUrl,
    });

    // Audit metadata deliberately excludes signal_contact (personal data).
    await insertContributionsAudit({
      actorUserId: gate.auth.userId,
      action: 'contributions.submission.create',
      targetSubmissionId: submission.id,
      metadata: { kind: submission.kind, method: submission.method, cycleId: submission.cycleId },
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution submission unavailable.', 'submission_create');
  }
}

export async function GET() {
  const gate = await requireContributionsUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const submissions = await listOwnSubmissions(gate.auth.userId);
    return NextResponse.json({ ok: true, submissions });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution history unavailable.', 'submission_list_own');
  }
}
