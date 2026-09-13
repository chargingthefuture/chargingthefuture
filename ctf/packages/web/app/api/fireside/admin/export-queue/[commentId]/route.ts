import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureMutationCsrf, requireFiresideAdmin } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { reviewExportRequest } from 'lib/fireside/export-review';
import { insertFiresideAudit } from 'lib/fireside/repository';
import { failureReason, failureResponse } from 'lib/errors/failure';

type RouteProps = { params: Promise<{ commentId: string }> };

const bodySchema = z.object({
  action: z.enum(['approve', 'refuse']),
  reason: z.string().max(500).default(''),
});

/**
 * An admin turns the second key, or declines to.
 *
 * Approving here does not publish anything by itself: the author's own opt-in still has to be on
 * when the copy is made, and they can switch it off at any point before that. Refusing is final for
 * that comment — the author can no longer re-queue it by toggling the switch, which is what keeps a
 * refusal from being a speed bump to somebody posting bait on purpose.
 *
 * Only a pending request can be decided, so a double click cannot overturn a decision and an
 * approval cannot be granted for something nobody asked to have exported.
 */
export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireFiresideAdmin();
  if (!gate.allowed) return gate.response;

  const { commentId } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'Send an action of approve or refuse.' },
      { status: 400 },
    );
  }

  try {
    const done = await reviewExportRequest({
      adminId: gate.auth.userId,
      commentId,
      action: parsed.data.action,
      reason: parsed.data.reason,
    });
    if (!done) {
      return NextResponse.json(
        {
          ok: false,
          code: FIRESIDE_ERROR_CODE.notFound,
          message:
            'No pending export request with that id. It may already have been decided, withdrawn by its author, or removed from the conversation.',
        },
        { status: 404 },
      );
    }
    await insertFiresideAudit({
      actorId: gate.auth.userId,
      command: `fireside.export.${parsed.data.action}`,
      policyStatus: 'allow',
      reason: parsed.data.reason || 'export_review',
      targetType: 'comment',
      targetId: commentId,
      result: parsed.data.action === 'approve' ? 'export_approved' : 'export_refused',
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to record that export decision',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'export_review',
      status: 503,
      audience: 'operator',
    });
  }
}
