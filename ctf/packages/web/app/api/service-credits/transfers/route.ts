import { NextResponse } from 'next/server';
import { createTransfer, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { ensureMutationCsrf, requireServiceCreditsReadAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { isRegisteredPluginSlug } from 'lib/plugins/repository';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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

type ParsedTransferRequest = {
  recipientUserId: string;
  amount: number;
  idempotencyKey: string;
  originPlugin: string;
  reasonCode: string | undefined;
  rail: 'mutual_credit' | undefined;
};

// Validate the required transfer fields (and the optional rail enum). Returns the narrowed core
// values on success, or a ready 400 response on failure. Checks are kept verbatim and in order.
function validateTransferFields(
  body: TransferBody,
): { error: NextResponse } | { recipientUserId: string; amount: number; idempotencyKey: string } {
  if (!body.recipientUserId || typeof body.amount !== 'number' || !(body.amount > 0) || !Number.isFinite(body.amount) || !body.idempotencyKey) {
    return { error: NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'recipientUserId, amount and idempotencyKey are required.' }, { status: 400 }) };
  }

  if (body.rail !== undefined && body.rail !== 'balance' && body.rail !== 'mutual_credit') {
    return { error: NextResponse.json({ ok: false, code: 'service_credits_invalid_payload', message: 'rail must be "balance" or "mutual_credit".' }, { status: 400 }) };
  }

  return { recipientUserId: body.recipientUserId, amount: body.amount, idempotencyKey: body.idempotencyKey };
}

// Resolve and validate the origin plugin. Returns the resolved slug or a ready 400 response.
function resolveTransferOriginPlugin(body: TransferBody): { error: NextResponse } | { originPlugin: string } {
  // The access policy for transfer.create denies invalid_origin_plugin / disallowed_cross_plugin_path.
  // Enforce that here: when originPlugin is supplied it must name a real plugin, so an arbitrary string
  // can never be stored as the cross-plugin path. Omitting it means a direct send from this app.
  const originPlugin =
    typeof body.originPlugin === 'string' && body.originPlugin.trim().length > 0
      ? body.originPlugin.trim()
      : DEFAULT_ORIGIN_PLUGIN;
  if (!isRegisteredPluginSlug(originPlugin)) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'service_credits_invalid_origin_plugin', message: 'originPlugin must be a registered plugin.' },
        { status: 400 },
      ),
    };
  }

  return { originPlugin };
}

// Validate/normalize the transfer body. Returns the parsed request on success or a ready 400
// response on failure. Preserves the original validation order and every check verbatim.
function parseTransferBody(body: TransferBody): { error: NextResponse } | { data: ParsedTransferRequest } {
  const fields = validateTransferFields(body);
  if ('error' in fields) {
    return { error: fields.error };
  }

  const origin = resolveTransferOriginPlugin(body);
  if ('error' in origin) {
    return { error: origin.error };
  }

  return {
    data: {
      recipientUserId: fields.recipientUserId,
      amount: fields.amount,
      idempotencyKey: fields.idempotencyKey,
      originPlugin: origin.originPlugin,
      reasonCode: typeof body.reasonCode === 'string' ? body.reasonCode : undefined,
      rail: body.rail === 'mutual_credit' ? 'mutual_credit' : undefined,
    },
  };
}

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
  } catch (error) {
    return NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = parseTransferBody(body);
  if ('error' in parsed) {
    return parsed.error;
  }

  try {
    const transfer = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: parsed.data.recipientUserId,
      amount: parsed.data.amount,
      idempotencyKey: parsed.data.idempotencyKey,
      originPlugin: parsed.data.originPlugin,
      reasonCode: parsed.data.reasonCode,
      rail: parsed.data.rail,
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
