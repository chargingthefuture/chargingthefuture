import { NextResponse } from 'next/server';
import {
  cardIdFrom,
  cardsDenied,
  cardsFailed,
  ensureMutationCsrf,
  invalidCard,
  rateLimited,
  readAccountId,
  readJson,
  requireCardsAccess,
} from 'lib/today/cards/access';
import { findReadableMessage } from 'lib/today/cards/repository';
import { reportDetail } from 'lib/today/cards/report';
import { insertSafetyReportTx } from 'lib/safety/repository';
import { withDbTransaction } from 'lib/db/postgres';
import { logSafetyReportCreateAudit } from 'lib/blocks/audit';

// POST /api/today/cards/[cardId]/report { messageId } or { authorId }: report a message in a card
// (one the reporter can read) or the card itself (authorId is the card's author). Writes a row to
// member_safety_reports, which the admin reports screen lists, naming the card and, for a message,
// its text cut to 500 characters. Nobody can report themselves.

export const dynamic = 'force-dynamic';

const REPORTS_PER_HOUR = 20;

type Context = { params: Promise<{ cardId: string }> };
type Target = { reportedId: string; detail: string };

// Who is reported and what the admin reads, or the refusal.
async function readTarget(cardId: string, userId: string, json: Record<string, unknown> | null): Promise<Target | NextResponse> {
  const messageId = readAccountId(json?.messageId);
  if (messageId) {
    const message = await findReadableMessage(cardId, messageId, userId);
    if (!message) return cardsDenied('message_not_found', 'That message is not on this card, or you cannot read it.', 404);
    return { reportedId: message.authorId, detail: reportDetail(cardId, message.body) };
  }
  const authorId = readAccountId(json?.authorId);
  if (!authorId) return cardsDenied('invalid_report', 'Send messageId (a message in this card) or authorId (the card author).', 400);
  return { reportedId: authorId, detail: reportDetail(cardId, null) };
}

export async function POST(request: Request, context: Context) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireCardsAccess();
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;
  const cardId = await cardIdFrom(context);
  if (!cardId) return invalidCard();
  const limited = rateLimited(`today-cards:report:${userId}`, REPORTS_PER_HOUR, 3_600_000, 'Too many reports this hour. Try again later.');
  if (limited) return limited;
  const json = await readJson(request);
  try {
    const target = await readTarget(cardId, userId, json);
    if (target instanceof NextResponse) return target;
    if (target.reportedId === userId) return cardsDenied('self_report', 'You cannot report your own card or message.', 400);
    await withDbTransaction((client) => insertSafetyReportTx(client, userId, target.reportedId, target.detail));
    logSafetyReportCreateAudit({ actorId: userId, status: 'allow', reason: 'today_card_report_recorded', result: 'success', errorCategory: null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return cardsFailed('report', error, 'The report was not saved: the database write failed. Try again.');
  }
}
