import { describe, expect, it } from 'vitest';
import { seCardAnswerKind, seCardIdValid, seCardOpensSheet, seCardPair } from '@ctf/shared';
import { readCardId } from './ids';
import { reportDetail } from './report';
import { groupAnswers, pairState, shapeConversation, type ConversationRows } from './shape';
import type { MessageRow, PairRow } from './repository';

const at = new Date('2026-11-03T12:00:00Z');
const handles = new Map<string, string | null>([
  ['acc_a', 'ana'],
  ['acc_b', 'ben'],
  ['acc_c', 'cy'],
]);

function message(id: string, authorId: string, pair: [string, string] | null): MessageRow {
  return { id, authorId, body: `body ${id}`, createdAt: at, editedAt: null, pairLow: pair?.[0] ?? null, pairHigh: pair?.[1] ?? null };
}

describe('card ids', () => {
  it('takes a source, a colon and an id, and refuses 21 Questions cards', () => {
    expect(seCardIdValid('trust-transport:123')).toBe(true);
    expect(seCardIdValid('directory-invite:https://example.org/a')).toBe(true);
    expect(seCardIdValid('questions:q1')).toBe(false);
    expect(seCardIdValid('questions-match:acc')).toBe(false);
    expect(seCardIdValid('Bad:1')).toBe(false);
    expect(seCardIdValid('trust-transport:has space')).toBe(false);
    expect(seCardIdValid(`a:${'x'.repeat(199)}`)).toBe(false);
  });

  it('decodes a segment Next left percent-encoded, once', () => {
    expect(readCardId('trust-transport%3A123')).toBe('trust-transport:123');
    expect(readCardId('trust-transport:123')).toBe('trust-transport:123');
    expect(readCardId('lighthouse:a%3Ab')).toBe('lighthouse:a%3Ab');
    expect(readCardId('nope')).toBeNull();
  });

  it('opens a sheet for asks, offers and stories only', () => {
    expect(seCardOpensSheet({ kind: 'ask', source: 'peer-programming' })).toBe(true);
    expect(seCardOpensSheet({ kind: 'story', source: 'what-works' })).toBe(true);
    expect(seCardOpensSheet({ kind: 'match', source: 'questions' })).toBe(false);
    expect(seCardOpensSheet({ kind: 'mood', source: 'mood' })).toBe(false);
    expect(seCardAnswerKind('help')).toBe('help');
    expect(seCardAnswerKind('open')).toBeNull();
  });

  it('keys a pair lower id first', () => {
    expect(seCardPair('acc_b', 'acc_a')).toEqual(['acc_a', 'acc_b']);
    expect(seCardPair('acc_a', 'acc_b')).toEqual(['acc_a', 'acc_b']);
  });
});

describe('shapeConversation', () => {
  const agreed: PairRow = { low: 'acc_a', high: 'acc_b', requesterId: 'acc_a', agreedAt: at };
  const pending: PairRow = { low: 'acc_a', high: 'acc_c', requesterId: 'acc_c', agreedAt: null };
  const rows: ConversationRows = {
    answers: [
      { accountId: 'acc_b', kind: 'know-someone', createdAt: at },
      { accountId: 'acc_b', kind: 'help', createdAt: at },
      { accountId: 'acc_a', kind: 'want', createdAt: at },
    ],
    publicMessages: [message('m1', 'acc_b', null), message('m-leak', 'acc_b', ['acc_a', 'acc_b'])],
    pairs: [agreed, pending, { low: 'acc_b', high: 'acc_c', requesterId: 'acc_b', agreedAt: at }],
    pairMessages: [message('p1', 'acc_a', ['acc_a', 'acc_b']), message('p2', 'acc_c', ['acc_a', 'acc_c']), message('p3', 'acc_b', ['acc_b', 'acc_c'])],
  };

  it('groups answers by member in a fixed order and names the viewer', () => {
    const answers = groupAnswers(rows.answers, handles);
    expect(answers[0]).toEqual({ accountId: 'acc_b', handle: 'ben', kinds: ['help', 'know-someone'] });
    const shaped = shapeConversation('lighthouse:1', 'acc_a', rows, handles);
    expect(shaped.viewerId).toBe('acc_a');
    expect(shaped.mine).toEqual(['want']);
  });

  it('keeps private messages out of the public conversation', () => {
    const shaped = shapeConversation('lighthouse:1', 'acc_a', rows, handles);
    expect(shaped.messages.map((m) => m.id)).toEqual(['m1']);
  });

  it('shows only the viewer\'s own pairs, and private messages only once both agreed', () => {
    const shaped = shapeConversation('lighthouse:1', 'acc_a', rows, handles);
    expect(shaped.pairs.map((p) => [p.partnerHandle, p.state])).toEqual([
      ['ben', 'open'],
      ['cy', 'asked-me'],
    ]);
    expect(shaped.pairs[0].messages.map((m) => [m.id, m.mine])).toEqual([['p1', true]]);
    expect(shaped.pairs[1].messages).toEqual([]);
  });

  it('says when a message was changed, and nothing for one never changed', () => {
    const edited = new Date('2026-11-03T12:00:00Z');
    const changed = { ...rows, publicMessages: [{ ...rows.publicMessages[0], editedAt: edited }] };
    expect(shapeConversation('lighthouse:1', 'acc_a', changed, handles).messages[0].editedAtIso).toBe(edited.toISOString());
    expect(shapeConversation('lighthouse:1', 'acc_a', rows, handles).messages[0].editedAtIso).toBeNull();
  });

  it('says who waits on whom', () => {
    expect(pairState(pending, 'acc_c')).toBe('waiting');
    expect(pairState(pending, 'acc_a')).toBe('asked-me');
    expect(pairState(agreed, 'acc_b')).toBe('open');
  });
});

describe('reportDetail', () => {
  it('names the card, and cuts a message to 500 characters', () => {
    expect(reportDetail('lighthouse:1', null)).toBe('Reported from Today card lighthouse:1: the card itself.');
    const detail = reportDetail('lighthouse:1', 'x'.repeat(600));
    expect(detail.endsWith(`${'x'.repeat(500)}…`)).toBe(true);
  });
});
