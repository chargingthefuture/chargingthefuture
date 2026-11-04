import {
  SE_CARD_ANSWER_KINDS,
  type SeCardAnswer,
  type SeCardAnswerKind,
  type SeCardConversation,
  type SeCardMessage,
  type SeCardPairState,
  type SeCardPairThread,
} from '@ctf/shared';
import type { AnswerRow, MessageRow, PairRow } from './repository';

// Turns the rows read for one viewer into what the sheet draws. Pure, so the visibility rules are
// tested without a database: a Just us two message is only ever placed in a thread the viewer is
// part of and both agreed to, whatever rows are handed in.

export type ConversationRows = { answers: AnswerRow[]; publicMessages: MessageRow[]; pairs: PairRow[]; pairMessages: MessageRow[] };

export function handleOf(handles: Map<string, string | null>, accountId: string): string {
  return handles.get(accountId) || `user-${accountId.slice(0, 8)}`;
}

export function idsIn(rows: ConversationRows): string[] {
  const ids = new Set<string>();
  rows.answers.forEach((row) => ids.add(row.accountId));
  rows.publicMessages.forEach((row) => ids.add(row.authorId));
  rows.pairs.forEach((row) => [row.low, row.high].forEach((id) => ids.add(id)));
  return [...ids];
}

// One row per member, their answers in a fixed order, first to answer first.
export function groupAnswers(rows: AnswerRow[], handles: Map<string, string | null>): SeCardAnswer[] {
  const byMember = new Map<string, Set<SeCardAnswerKind>>();
  for (const row of rows) byMember.set(row.accountId, (byMember.get(row.accountId) ?? new Set()).add(row.kind));
  return [...byMember.entries()].map(([accountId, kinds]) => ({
    accountId,
    handle: handleOf(handles, accountId),
    kinds: SE_CARD_ANSWER_KINDS.filter((kind) => kinds.has(kind)),
  }));
}

export function pairState(pair: PairRow, viewerId: string): SeCardPairState {
  if (pair.agreedAt) return 'open';
  return pair.requesterId === viewerId ? 'waiting' : 'asked-me';
}

function toMessage(row: MessageRow, viewerId: string, handles: Map<string, string | null>): SeCardMessage {
  return {
    id: row.id,
    authorId: row.authorId,
    handle: handleOf(handles, row.authorId),
    mine: row.authorId === viewerId,
    body: row.body,
    createdAtIso: row.createdAt.toISOString(),
    editedAtIso: row.editedAt ? row.editedAt.toISOString() : null,
  };
}

function threadFor(pair: PairRow, viewerId: string, rows: MessageRow[], handles: Map<string, string | null>): SeCardPairThread {
  const partnerId = pair.low === viewerId ? pair.high : pair.low;
  const state = pairState(pair, viewerId);
  const messages = state === 'open' ? rows.filter((row) => row.pairLow === pair.low && row.pairHigh === pair.high) : [];
  return { partnerId, partnerHandle: handleOf(handles, partnerId), state, messages: messages.map((row) => toMessage(row, viewerId, handles)) };
}

export function shapeConversation(cardId: string, viewerId: string, rows: ConversationRows, handles: Map<string, string | null>): SeCardConversation {
  const pairs = rows.pairs.filter((pair) => pair.low === viewerId || pair.high === viewerId);
  return {
    cardId,
    viewerId,
    answers: groupAnswers(rows.answers, handles),
    mine: SE_CARD_ANSWER_KINDS.filter((kind) => rows.answers.some((row) => row.accountId === viewerId && row.kind === kind)),
    messages: rows.publicMessages.filter((row) => row.pairLow === null).map((row) => toMessage(row, viewerId, handles)),
    pairs: pairs.map((pair) => threadFor(pair, viewerId, rows.pairMessages, handles)),
  };
}
