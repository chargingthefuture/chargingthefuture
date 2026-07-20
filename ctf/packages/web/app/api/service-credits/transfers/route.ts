import { NextResponse } from 'next/server';
import { createTransfer, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsReadAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { isRegisteredPluginSlug } from 'lib/plugins/repository';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';

// A transfer with no originPlugin is a direct member-to-member send from the ServiceCredits app
// itself, so it defaults to this plugin's own path.
const DEFAULT_ORIGIN_PLUGIN = 'service-credits';

type TransferBody = {
  recipientUserId?: string;
  amount?: number;
  idempotencyKey?: string;
  originPlugin?: string;
  reasonCode?: string;
  rail?: 'balance' | 'mutual_credit';
};

export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: TransferBody;
  try {
    body = (await request.json()) as TransferBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.recipientUserId || typeof body.amount !== 'number' || !(body.amount > 0) || !Number.isFinite(body.amount) || !body.idempotencyKey) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'recipientUserId, amount and idempotencyKey are required.' }, { status: 400 });
  }

  if (body.rail !== undefined && body.rail !== 'balance' && body.rail !== 'mutual_credit') {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'rail must be "balance" or "mutual_credit".' }, { status: 400 });
  }

  // The access policy for transfer.create denies invalid_origin_plugin / disallowed_cross_plugin_path.
  // Enforce that here: when originPlugin is supplied it must name a real plugin, so an arbitrary string
  // can never be stored as the cross-plugin path. Omitting it means a direct send from this app.
  const originPlugin =
    typeof body.originPlugin === 'string' && body.originPlugin.trim().length > 0
      ? body.originPlugin.trim()
      : DEFAULT_ORIGIN_PLUGIN;
  if (!isRegisteredPluginSlug(originPlugin)) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_origin_plugin', message: 'originPlugin must be a registered plugin.' },
      { status: 400 },
    );
  }

  try {
    const transfer = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: body.recipientUserId,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
      originPlugin,
      reasonCode: typeof body.reasonCode === 'string' ? body.reasonCode : undefined,
      rail: body.rail === 'mutual_credit' ? 'mutual_credit' : undefined,
    });

    await insertServiceCreditsAudit({
      actorId: gate.auth.userId,
      command: 'service-credits.transfer.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'transfer',
      targetId: transfer.id,
      metadata: {
        amount: transfer.amount,
        recipientUserId: transfer.recipientUserId,
        status: transfer.status,
        escrowHoldId: transfer.escrowHoldId,
      },
    });

    // Notify the recipient that credits landed — best-effort, only for a completed transfer to
    // someone other than the sender. Deduped on the transfer id, so an idempotent retry never
    // double-notifies. Neutral summary; ServiceCredits are a non-fiat internal unit, not money.
    if (transfer.status === 'completed' && transfer.recipientUserId !== gate.auth.userId) {
      await notifySafe({
        userId: transfer.recipientUserId,
        sourcePlugin: 'service-credits',
        notificationType: 'service-credits.received',
        category: 'activity',
        summary: `You received ${transfer.amount} ServiceCredits.`,
        linkPath: '/apps/service-credits',
        targetRef: transfer.id,
      });
    }

    return NextResponse.json({ ok: true, transfer }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'transfers' });
    return serviceCreditsErrorResponse(error, 'Transfer unavailable.');
  }
}
